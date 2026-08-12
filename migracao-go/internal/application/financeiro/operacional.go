package financeiro

import (
	"context"
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"

	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	"siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorOperacional struct {
	Repo  dominio.OperacaoRepositorio
	Agora func() time.Time
}

type EntradaTitulo struct{ Tipo, ContraparteNome, Descricao, Emissao, Vencimento, Valor string }
type EntradaFaturamento struct{ ClienteNome, Descricao, TipoOperacao, Emissao, Vencimento, ValorBruto, Desconto, Acrescimo, ModeloFiscal, EmissorFiscal, Observacao, ChaveIdempotencia string }

func dataISO(valor string) (time.Time, error) {
	t, err := time.Parse(time.DateOnly, strings.TrimSpace(valor))
	if err != nil {
		return time.Time{}, fmt.Errorf("data inválida")
	}
	return t, nil
}
func centavos(valor string, permitirZero bool) (dominio.Centavos, error) {
	texto := strings.TrimSpace(valor)
	if texto == "" && permitirZero {
		return 0, nil
	}
	if texto == "" || strings.HasPrefix(texto, "-") || strings.HasPrefix(texto, "+") {
		return 0, fmt.Errorf("valor inválido")
	}

	// O financeiro trabalha em centavos. A entrada pode usar a notação brasileira
	// (1.234,56) ou a decimal simples (1234.56), mas nunca é convertida por float64.
	// Assim não existe arredondamento binário em valores de baixa, rateio ou imposto.
	separador := ""
	if strings.Contains(texto, ",") {
		if strings.Count(texto, ",") != 1 {
			return 0, fmt.Errorf("valor inválido")
		}
		separador = ","
	} else if strings.Count(texto, ".") == 1 {
		separador = "."
	}

	inteiro, fracao := texto, ""
	if separador != "" {
		partes := strings.SplitN(texto, separador, 2)
		inteiro, fracao = partes[0], partes[1]
		if fracao == "" || len(fracao) > 2 || !soNumeros(fracao) {
			// Um ponto seguido de três dígitos é grupo de milhar (1.234), não
			// uma fração que seria arredondada silenciosamente.
			if separador == "." && len(fracao) == 3 && soNumeros(fracao) {
				inteiro += fracao
				fracao = ""
			} else {
				return 0, fmt.Errorf("valor inválido")
			}
		}
	}
	if strings.Contains(inteiro, ".") || strings.Contains(inteiro, ",") {
		if separador != "," || strings.Contains(inteiro, ",") {
			return 0, fmt.Errorf("valor inválido")
		}
		grupos := strings.Split(inteiro, ".")
		if len(grupos) < 2 || len(grupos[0]) < 1 || len(grupos[0]) > 3 {
			return 0, fmt.Errorf("valor inválido")
		}
		for i, grupo := range grupos {
			if (i == 0 && (len(grupo) < 1 || len(grupo) > 3)) || (i > 0 && len(grupo) != 3) || !soNumeros(grupo) {
				return 0, fmt.Errorf("valor inválido")
			}
		}
		inteiro = strings.Join(grupos, "")
	}
	if inteiro == "" || !soNumeros(inteiro) {
		return 0, fmt.Errorf("valor inválido")
	}
	if len(fracao) == 1 {
		fracao += "0"
	}
	if fracao == "" {
		fracao = "00"
	}
	valorInteiro, err := strconv.ParseInt(inteiro, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("valor inválido")
	}
	valorFracao, err := strconv.ParseInt(fracao, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("valor inválido")
	}
	resultado := valorInteiro*100 + valorFracao
	if resultado <= 0 && !permitirZero {
		return 0, fmt.Errorf("valor inválido")
	}
	return dominio.Centavos(resultado), nil
}

// ParseCentavos é a entrada única para handlers e adaptadores externos. Mantém a
// validação monetária no caso de uso, inclusive para baixas recebidas por formulário.
func ParseCentavos(valor string, permitirZero bool) (dominio.Centavos, error) {
	return centavos(valor, permitirZero)
}

func soNumeros(valor string) bool {
	if valor == "" {
		return false
	}
	for _, r := range valor {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
func (g *GerenciadorOperacional) agora() time.Time {
	if g.Agora != nil {
		return g.Agora()
	}
	return time.Now().UTC()
}

func (g *GerenciadorOperacional) competenciaAberta(ctx context.Context, competencia string) error {
	if fechamento, ok := g.Repo.(dominio.FechamentoRepositorio); ok {
		fechada, err := fechamento.CompetenciaFechada(ctx, competencia)
		if err != nil {
			return err
		}
		if fechada {
			return dominio.ErrCompetenciaFechada
		}
	}
	return nil
}

func (g *GerenciadorOperacional) CriarTitulo(ctx context.Context, s identidade.Sessao, e EntradaTitulo) (*dominio.Titulo, error) {
	if !identidade.FinanceiroPodeLancar(s) {
		return nil, fmt.Errorf("seu cargo não lança títulos")
	}
	tipo := dominio.TipoTitulo(strings.ToUpper(strings.TrimSpace(e.Tipo)))
	if tipo != dominio.TituloPagar && tipo != dominio.TituloReceber {
		return nil, fmt.Errorf("tipo de título inválido")
	}
	if strings.TrimSpace(e.ContraparteNome) == "" || strings.TrimSpace(e.Descricao) == "" {
		return nil, fmt.Errorf("contraparte e descrição são obrigatórias")
	}
	emissao, err := dataISO(e.Emissao)
	if err != nil {
		return nil, err
	}
	vencimento, err := dataISO(e.Vencimento)
	if err != nil {
		return nil, err
	}
	valor, err := centavos(e.Valor, false)
	if err != nil {
		return nil, err
	}
	if err := g.competenciaAberta(ctx, emissao.Format("2006-01")); err != nil {
		return nil, err
	}
	t := &dominio.Titulo{Tipo: tipo, ContraparteNome: strings.TrimSpace(e.ContraparteNome), Descricao: strings.TrimSpace(e.Descricao), Emissao: emissao, Competencia: emissao.Format("2006-01"), ValorTotal: valor, ValorAberto: valor}
	if err = g.Repo.CriarTituloManual(ctx, t, vencimento, s.ID, s.Nome); err != nil {
		return nil, err
	}
	return t, nil
}
func (g *GerenciadorOperacional) CriarConta(ctx context.Context, s identidade.Sessao, nome, tipo string) error {
	if !identidade.FinanceiroPodeAdministrar(s) {
		return fmt.Errorf("somente administração cadastra contas financeiras")
	}
	nome, tipo = strings.TrimSpace(nome), strings.ToUpper(strings.TrimSpace(tipo))
	if nome == "" || (tipo != "BANCO" && tipo != "CAIXA") {
		return fmt.Errorf("nome e tipo de conta válidos são obrigatórios")
	}
	return g.Repo.CriarConta(ctx, &dominio.ContaFinanceira{Nome: nome, Tipo: tipo, Moeda: "BRL", Ativo: true})
}
func (g *GerenciadorOperacional) AprovarTitulo(ctx context.Context, s identidade.Sessao, id string) error {
	if !identidade.FinanceiroPodeAprovar(s) {
		return fmt.Errorf("seu cargo não aprova títulos")
	}
	return g.Repo.AprovarTitulo(ctx, id, s.ID, s.Nome)
}

func (g *GerenciadorOperacional) CriarFaturamento(ctx context.Context, s identidade.Sessao, e EntradaFaturamento) (*dominio.Faturamento, error) {
	if !identidade.FinanceiroPodeLancar(s) {
		return nil, fmt.Errorf("seu cargo não cria faturamento")
	}
	if strings.TrimSpace(e.ClienteNome) == "" || strings.TrimSpace(e.Descricao) == "" {
		return nil, fmt.Errorf("cliente e descrição são obrigatórios")
	}
	tipo := strings.ToUpper(strings.TrimSpace(e.TipoOperacao))
	if tipo != "PRODUTO" && tipo != "SERVICO" {
		return nil, fmt.Errorf("operação inválida")
	}
	modelo := strings.ToUpper(strings.TrimSpace(e.ModeloFiscal))
	if modelo != "NFE" && modelo != "NFSE" && modelo != "SEM_NOTA" {
		return nil, fmt.Errorf("modelo fiscal inválido")
	}
	emissor := strings.ToUpper(strings.TrimSpace(e.EmissorFiscal))
	esperado := "SEFAZ"
	if modelo == "NFSE" {
		esperado = "NFSE_NACIONAL"
	}
	if modelo == "SEM_NOTA" {
		esperado = "EXTERNO"
	}
	if emissor == "" {
		emissor = esperado
	}
	if modelo == "NFE" && emissor != "SEFAZ" || modelo == "NFSE" && emissor != "NFSE_NACIONAL" || modelo == "SEM_NOTA" && emissor != "EXTERNO" {
		return nil, fmt.Errorf("emissor não corresponde ao modelo fiscal")
	}
	emissao, err := dataISO(e.Emissao)
	if err != nil {
		return nil, err
	}
	if err := g.competenciaAberta(ctx, emissao.Format("2006-01")); err != nil {
		return nil, err
	}
	vencimento, err := dataISO(e.Vencimento)
	if err != nil {
		return nil, err
	}
	bruto, err := centavos(e.ValorBruto, false)
	if err != nil {
		return nil, err
	}
	desconto, err := centavos(e.Desconto, true)
	if err != nil {
		return nil, err
	}
	acrescimo, err := centavos(e.Acrescimo, true)
	if err != nil {
		return nil, err
	}
	liquido := bruto - desconto + acrescimo
	if liquido <= 0 {
		return nil, fmt.Errorf("valor líquido deve ser positivo")
	}
	chave := strings.TrimSpace(e.ChaveIdempotencia)
	if chave == "" {
		return nil, fmt.Errorf("chave de idempotência é obrigatória")
	}
	f := &dominio.Faturamento{ClienteNome: strings.TrimSpace(e.ClienteNome), Descricao: strings.TrimSpace(e.Descricao), TipoOperacao: tipo, Emissao: emissao, Vencimento: vencimento, ValorBruto: bruto, Desconto: desconto, Acrescimo: acrescimo, ValorLiquido: liquido, ModeloFiscal: modelo, EmissorFiscal: emissor, ChaveIdempotencia: chave, Observacao: ponteiro(e.Observacao), CriadoPorID: s.ID, CriadoPorNome: s.Nome}
	if err = g.Repo.CriarFaturamento(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}
func (g *GerenciadorOperacional) Faturar(ctx context.Context, s identidade.Sessao, id string) error {
	if !identidade.FinanceiroPodeLancar(s) {
		return fmt.Errorf("seu cargo não finaliza faturamento")
	}
	return g.Repo.FinalizarFaturamento(ctx, id, s.ID, s.Nome)
}

type xmlSebrae struct {
	NFe struct {
		InfNFe struct {
			ID  string `xml:"Id,attr"`
			Ide struct {
				Numero   string `xml:"nNF"`
				Serie    string `xml:"serie"`
				DataHora string `xml:"dhEmi"`
				Data     string `xml:"dEmi"`
			} `xml:"ide"`
			Dest struct {
				Nome string `xml:"xNome"`
			} `xml:"dest"`
			Total struct {
				ICMSTot struct {
					Valor string `xml:"vNF"`
				} `xml:"ICMSTot"`
			} `xml:"total"`
		} `xml:"infNFe"`
	} `xml:"NFe"`
	Protocolo struct {
		Info struct {
			Chave    string `xml:"chNFe"`
			Numero   string `xml:"nProt"`
			Recebido string `xml:"dhRecbto"`
		} `xml:"infProt"`
	} `xml:"protNFe"`
}

func somenteDigitos(v string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, v)
}
func (g *GerenciadorOperacional) ImportarSebrae(ctx context.Context, s identidade.Sessao, xmlConteudo, vencimento string) (*dominio.DocumentoFiscal, error) {
	if !identidade.FinanceiroPodeLancar(s) {
		return nil, fmt.Errorf("seu cargo não importa documentos")
	}
	xmlConteudo = strings.TrimSpace(xmlConteudo)
	if xmlConteudo == "" || len(xmlConteudo) > 1024*1024 {
		return nil, fmt.Errorf("XML obrigatório e limitado a 1 MB")
	}
	var arquivo xmlSebrae
	if err := xml.Unmarshal([]byte(xmlConteudo), &arquivo); err != nil {
		return nil, fmt.Errorf("XML de NF-e inválido: %w", err)
	}
	chave := somenteDigitos(arquivo.Protocolo.Info.Chave)
	if chave == "" {
		chave = somenteDigitos(strings.TrimPrefix(arquivo.NFe.InfNFe.ID, "NFe"))
	}
	if len(chave) != 44 {
		return nil, fmt.Errorf("chave de acesso NF-e não encontrada")
	}
	valor, err := centavos(arquivo.NFe.InfNFe.Total.ICMSTot.Valor, false)
	if err != nil {
		return nil, fmt.Errorf("total da NF-e inválido")
	}
	emissaoTexto := arquivo.NFe.InfNFe.Ide.DataHora
	if emissaoTexto == "" {
		emissaoTexto = arquivo.NFe.InfNFe.Ide.Data
	}
	emissao, err := time.Parse(time.RFC3339, emissaoTexto)
	if err != nil {
		emissao, err = time.Parse(time.DateOnly, emissaoTexto)
	}
	if err != nil {
		return nil, fmt.Errorf("emissão da NF-e inválida")
	}
	if err := g.competenciaAberta(ctx, emissao.Format("2006-01")); err != nil {
		return nil, err
	}
	venc := emissao.AddDate(0, 0, 30)
	if strings.TrimSpace(vencimento) != "" {
		venc, err = dataISO(vencimento)
		if err != nil {
			return nil, err
		}
	}
	cliente := strings.TrimSpace(arquivo.NFe.InfNFe.Dest.Nome)
	if cliente == "" {
		return nil, fmt.Errorf("destinatário não encontrado no XML")
	}
	autorizado := g.agora()
	if arquivo.Protocolo.Info.Recebido != "" {
		if t, x := time.Parse(time.RFC3339, arquivo.Protocolo.Info.Recebido); x == nil {
			autorizado = t
		}
	}
	f := &dominio.Faturamento{ClienteNome: cliente, Descricao: "NF-e Sebrae " + arquivo.NFe.InfNFe.Ide.Numero, TipoOperacao: "PRODUTO", Emissao: emissao, Vencimento: venc, ValorBruto: valor, ValorLiquido: valor, ModeloFiscal: "NFE", EmissorFiscal: "SEBRAE_LEGADO", ChaveIdempotencia: "SEBRAE:" + chave, CriadoPorID: s.ID, CriadoPorNome: s.Nome}
	d := &dominio.DocumentoFiscal{Direcao: "SAIDA", Modelo: "NFE", Emissor: "SEBRAE_LEGADO", Ambiente: "PRODUCAO", Status: "AUTORIZADO", ContraparteNome: cliente, Numero: ponteiro(arquivo.NFe.InfNFe.Ide.Numero), Serie: ponteiro(arquivo.NFe.InfNFe.Ide.Serie), Chave: &chave, Protocolo: ponteiro(arquivo.Protocolo.Info.Numero), Emissao: emissao, Valor: valor, XMLConteudo: &xmlConteudo, AutorizadoEm: &autorizado}
	if err = g.Repo.ImportarDocumentoLegado(ctx, f, d); err != nil {
		return nil, err
	}
	return d, nil
}
func (g *GerenciadorOperacional) RegistrarResultadoFiscal(ctx context.Context, s identidade.Sessao, id, status, chave, protocolo, xmlConteudo, erroTexto string) error {
	if !identidade.FinanceiroPodeLancar(s) {
		return fmt.Errorf("seu cargo não atualiza documento fiscal")
	}
	if len(xmlConteudo) > 1024*1024 {
		return fmt.Errorf("XML limitado a 1 MB")
	}
	status = strings.ToUpper(strings.TrimSpace(status))
	chave = somenteDigitos(chave)
	protocolo = strings.TrimSpace(protocolo)
	erroTexto = strings.TrimSpace(erroTexto)
	if status == "AUTORIZADO" && (len(chave) != 44 || protocolo == "") {
		return fmt.Errorf("autorização exige chave de 44 dígitos e protocolo")
	}
	if status == "REJEITADO" && erroTexto == "" {
		return fmt.Errorf("rejeição exige a mensagem retornada pelo autorizador")
	}
	if status == "CANCELADO" && (!identidade.FinanceiroPodeAprovar(s) || protocolo == "") {
		return fmt.Errorf("cancelamento exige aprovador e protocolo")
	}
	return g.Repo.RegistrarResultadoFiscal(ctx, id, status, chave, protocolo, strings.TrimSpace(xmlConteudo), erroTexto, s.ID, s.Nome)
}
