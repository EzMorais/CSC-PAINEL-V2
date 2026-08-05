package estoque

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorSolicitacoes struct {
	Solicitacoes   dominio.SolicitacaoRepositorio
	Materiais      dominio.MaterialRepositorio
	Aprovacoes     dominio.AprovacaoRepositorio
	Configuracao   dominio.ConfiguracaoEmailRepositorio
	EmailRemetente dominio.EmailRemetente
}

type ItemEntradaSolicitacao struct {
	MaterialID, Quantidade, SaldoNaEpoca, MinimoNaEpoca, PrecoEstimado string
}

type EntradaSolicitacao struct {
	Observacao string
	Itens      []ItemEntradaSolicitacao
}

type ResultadoSolicitacao struct {
	ID                string
	Numero            string
	PendenteAprovacao bool
}

func (g *GerenciadorSolicitacoes) proximoNumero(ctx context.Context) (string, error) {
	ano := agora().Year()
	prefixo := fmt.Sprintf("SC-%d-", ano)
	ultimo, err := g.Solicitacoes.UltimoNumeroDoAno(ctx, prefixo)
	if err != nil {
		return "", err
	}
	sequencia := 1
	if ultimo != "" {
		partes := strings.Split(ultimo, "-")
		if len(partes) == 3 {
			if n, err := strconv.Atoi(partes[2]); err == nil {
				sequencia = n + 1
			}
		}
	}
	return fmt.Sprintf("%s%04d", prefixo, sequencia), nil
}

// Criar espelha `criarSolicitacao` — se o total estimado passa do limite e o cargo não
// aprova sozinho, abre Aprovacao e PARA (o e-mail não sai, é o que não dá pra desfazer). Ver
// COMPORTAMENTO.md §7.
func (g *GerenciadorSolicitacoes) Criar(ctx context.Context, sess identidade.Sessao, e EntradaSolicitacao) (*ResultadoSolicitacao, error) {
	if len(e.Itens) == 0 {
		return nil, erroValidacao("Selecione ao menos um material.")
	}

	itens := make([]dominio.ItemSolicitacao, 0, len(e.Itens))
	var total float64
	for _, i := range e.Itens {
		materialID := strings.TrimSpace(i.MaterialID)
		if materialID == "" {
			return nil, erroValidacao("Item sem material selecionado.")
		}
		quantidade := parseFloatOpcional(i.Quantidade)
		if quantidade <= 0 {
			return nil, erroValidacao("Quantidade do item tem de ser maior que zero.")
		}
		item := dominio.ItemSolicitacao{
			MaterialID: materialID, Quantidade: quantidade,
			SaldoNaEpoca: parseFloatOpcional(i.SaldoNaEpoca), MinimoNaEpoca: parseFloatOpcional(i.MinimoNaEpoca),
		}
		if strings.TrimSpace(i.PrecoEstimado) != "" {
			preco := parseFloatOpcional(i.PrecoEstimado)
			item.PrecoEstimado = &preco
			total += preco * quantidade
		}
		itens = append(itens, item)
	}

	numero, err := g.proximoNumero(ctx)
	if err != nil {
		return nil, err
	}
	s := &dominio.SolicitacaoCompra{
		Numero: numero, Observacao: ponteiro(e.Observacao), RegistradoPor: ponteiro(sess.Nome), Itens: itens,
	}
	if err := g.Solicitacoes.Criar(ctx, s); err != nil {
		return nil, err
	}

	limites, err := obterLimites(ctx, g.Configuracao)
	if err != nil {
		return nil, err
	}
	if dominio.PrecisaAprovacao(identidade.PodeAprovar(sess.Cargo), limites.Compra > 0 && total > limites.Compra) {
		aprovacao := &dominio.Aprovacao{
			Tipo:   dominio.AprovacaoSolicitacaoCompra,
			Resumo: fmt.Sprintf("%s: %d %s, estimativa de %s.", s.Numero, len(itens), palavraItem(len(itens)), comum.BRL(&total)),
			Dados:  fmt.Sprintf(`{"solicitacaoId":%q}`, s.ID),
			Motivo: ponteiro(e.Observacao), SolicitanteID: sess.ID, SolicitanteNome: sess.Nome,
		}
		if err := g.Aprovacoes.Criar(ctx, aprovacao); err != nil {
			return nil, err
		}
		return &ResultadoSolicitacao{ID: s.ID, Numero: s.Numero, PendenteAprovacao: true}, nil
	}

	// Dispara o e-mail sozinho, se houver conta vinculada — falha no envio não desfaz o pedido.
	_, _ = g.DispararEmail(ctx, s.ID, "")
	return &ResultadoSolicitacao{ID: s.ID, Numero: s.Numero}, nil
}

func palavraItem(n int) string {
	if n == 1 {
		return "item"
	}
	return "itens"
}

type ResultadoEnvioEmail struct{ EnviadoPara string }

// DispararEmail espelha `dispararEmailDaSolicitacao` — nunca lança: é chamada logo depois de
// uma gravação que já deu certo. paraForcado vazio usa o destinatário padrão das Configurações.
func (g *GerenciadorSolicitacoes) DispararEmail(ctx context.Context, id string, paraForcado string) (*ResultadoEnvioEmail, error) {
	config, err := g.Configuracao.Obter(ctx)
	if err != nil {
		return nil, err
	}
	if config == nil || !config.Ativo {
		return nil, erroValidacao("Nenhuma conta de e-mail vinculada — use os botões do Gmail ou Outlook.")
	}
	if paraForcado == "" && !config.EnviarAutomatico {
		return nil, erroValidacao("O envio automático está desligado nas Configurações.")
	}

	destino := strings.TrimSpace(paraForcado)
	if destino == "" && config.DestinatarioPadrao != nil {
		destino = *config.DestinatarioPadrao
	}
	if destino == "" {
		return nil, erroValidacao("Nenhum destinatário: informe o e-mail do comprador nas Configurações.")
	}

	s, err := g.Solicitacoes.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, erroValidacao("Solicitação não encontrada.")
	}

	assunto := fmt.Sprintf("Solicitação de compra %s — Construtora Siqueira Campos", s.Numero)
	corpo := montarCorpoEmail(*s)

	copiaPara := ""
	if config.CopiaPara != nil {
		copiaPara = *config.CopiaPara
	}
	erroEnvio := g.EmailRemetente.Enviar(
		dominio.EmailConfig{Host: config.Host, Porta: config.Porta, Usuario: config.Usuario, Senha: config.Senha, Remetente: strPtrVal(config.Remetente)},
		dominio.EmailMensagem{Para: destino, Assunto: assunto, Corpo: corpo, CopiaPara: copiaPara},
	)

	if erroEnvio != nil {
		erro := g.EmailRemetente.TraduzirErro(erroEnvio)
		_ = g.Solicitacoes.AtualizarEnvioEmail(ctx, id, nil, nil, &erro, nil)
		return nil, erroValidacao(erro)
	}

	agoraStr := agora().Format(time.RFC3339)
	statusEnviada := dominio.StatusEnviada
	if err := g.Solicitacoes.AtualizarEnvioEmail(ctx, id, &destino, &agoraStr, nil, &statusEnviada); err != nil {
		return nil, err
	}
	return &ResultadoEnvioEmail{EnviadoPara: destino}, nil
}

func strPtrVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func montarCorpoEmail(s dominio.SolicitacaoCompra) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Solicitação de compra %s\n", s.Numero)
	registradoPor := ""
	if s.RegistradoPor != nil {
		registradoPor = " por " + *s.RegistradoPor
	}
	fmt.Fprintf(&b, "Emitida em %s%s\n\n", comum.DataLocalBR(s.CriadoEm), registradoPor)
	b.WriteString("Bom dia,\n\nPor favor, cotar os itens abaixo:\n\n")

	var total float64
	for i, item := range s.Itens {
		fmt.Fprintf(&b, "%d. %s (%s)\n", i+1, item.MaterialNome, item.MaterialCodigo)
		fmt.Fprintf(&b, "   Quantidade: %s %s\n", formatarNumero(item.Quantidade), item.MaterialUnidade)
		if item.PrecoEstimado != nil {
			total += *item.PrecoEstimado * item.Quantidade
			fmt.Fprintf(&b, "   Referência da última compra: %s por %s\n", comum.BRL(item.PrecoEstimado), item.MaterialUnidade)
		}
		b.WriteString("\n")
	}
	if total > 0 {
		fmt.Fprintf(&b, "Estimativa pela última compra: %s\n(valor apenas de referência interna, não é proposta)\n\n", comum.BRL(&total))
	}
	if s.Observacao != nil && *s.Observacao != "" {
		fmt.Fprintf(&b, "Observações:\n%s\n\n", *s.Observacao)
	}
	b.WriteString("Aguardo retorno com prazo de entrega e condição de pagamento.\n\nAtenciosamente,\nAlmoxarifado — Construtora Siqueira Campos")
	return b.String()
}

func (g *GerenciadorSolicitacoes) Listar(ctx context.Context) ([]dominio.SolicitacaoCompra, error) {
	return g.Solicitacoes.Listar(ctx)
}

func (g *GerenciadorSolicitacoes) Obter(ctx context.Context, id string) (*dominio.SolicitacaoCompra, error) {
	return g.Solicitacoes.BuscarPorID(ctx, id)
}

// MudarStatus NÃO mexe em saldo de propósito — quem cria estoque é a Movimentacao de
// ENTRADA lançada com a nota fiscal na mão. Ver COMPORTAMENTO.md §7.
func (g *GerenciadorSolicitacoes) MudarStatus(ctx context.Context, id, status string) error {
	s := dominio.StatusSolicitacao(status)
	if _, ok := dominio.RotuloStatusSolicitacao[s]; !ok {
		return erroValidacao("Status inválido.")
	}
	agoraStr := agora().Format(time.RFC3339)
	var enviadaEm, atendidaEm *string
	if s == dominio.StatusEnviada {
		enviadaEm = &agoraStr
	}
	if s == dominio.StatusAtendida {
		atendidaEm = &agoraStr
	}
	return g.Solicitacoes.AtualizarStatus(ctx, id, s, enviadaEm, atendidaEm)
}

// Excluir: só RASCUNHO pode sumir — depois de ENVIADA vira documento, correção é "cancelar".
func (g *GerenciadorSolicitacoes) Excluir(ctx context.Context, id string) error {
	s, err := g.Solicitacoes.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if s == nil {
		return erroValidacao("Solicitação não encontrada.")
	}
	if s.Status != dominio.StatusRascunho {
		return erroValidacao(`Só rascunho pode ser excluído. Use "cancelar" para encerrar um pedido já enviado.`)
	}
	return g.Solicitacoes.Excluir(ctx, id)
}

type ItemSugerido struct {
	MaterialID, Codigo, Nome, Unidade string
	Saldo, EstoqueMinimo              float64
	QuantidadeSugerida                float64
	PrecoEstimado                     *float64
}

// SugerirItens: sugere até o DOBRO do mínimo (não o mínimo exato — senão o item volta a
// bater no limite no dia seguinte). Ver COMPORTAMENTO.md §3.
func SugerirItens(materiais []dominio.MaterialComSaldo) []ItemSugerido {
	var itens []ItemSugerido
	for _, m := range materiais {
		if !m.Ativo || m.Situacao == dominio.SituacaoOK {
			continue
		}
		alvo := 1.0
		if m.EstoqueMinimo > 0 {
			alvo = m.EstoqueMinimo * 2
		}
		quantidade := alvo - m.Saldo
		if quantidade < 1 {
			quantidade = 1
		}
		itens = append(itens, ItemSugerido{
			MaterialID: m.ID, Codigo: m.Codigo, Nome: m.Nome, Unidade: m.Unidade,
			Saldo: m.Saldo, EstoqueMinimo: m.EstoqueMinimo, QuantidadeSugerida: quantidade, PrecoEstimado: m.UltimoPreco,
		})
	}
	return itens
}

func (g *GerenciadorSolicitacoes) ContarAbertas(ctx context.Context) (int, error) {
	return g.Solicitacoes.ContarAbertas(ctx)
}
