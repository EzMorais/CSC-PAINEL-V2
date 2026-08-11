package rh

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
	"siqueiracampos/servidor/internal/infrastructure/planilha"
)

// OpcaoObraImportacao é o suficiente do cadastro de Obra pra casar com o texto da planilha —
// função, não interface de cadastro.ObraRepositorio, mesma decisão de ResolverObraCodigo em
// funcionarios.go (este pacote não importa domain/cadastro).
type OpcaoObraImportacao struct{ ID, Codigo, Descricao string }

// GerenciadorImportacao espelha actions/importar-funcionarios.ts — COMPORTAMENTO.md §5.
type GerenciadorImportacao struct {
	Funcionarios dominio.FuncionarioRepositorio
	Cargos       dominio.CargoRepositorio

	ListarObras func(ctx context.Context) ([]OpcaoObraImportacao, error)
	CriarObra   func(ctx context.Context, cliente, codigo, descricao string) (id string, err error)

	mu    sync.Mutex
	cache map[string]previaCache
}

type previaCache struct {
	linhas   []planilha.LinhaFuncionarioImportado
	expiraEm time.Time
}

// ttlPrevia — tempo que a prévia fica em memória do processo esperando confirmação. Adaptação
// consciente do Next.js: lá o navegador guarda o arquivo (componente cliente, refaz o upload
// no confirmar) e o servidor relê do zero; aqui, sem JavaScript de estado no navegador, é o
// SERVIDOR que guarda as LINHAS JÁ INTERPRETADAS — nunca o arquivo bruto, nunca em disco,
// só em memória do processo, de uso único (apagada no primeiro Confirmar ou depois do TTL).
// Continua verdade o motivo original: nada com o CPF do quadro inteiro sobrevive em disco.
const ttlPrevia = 15 * time.Minute

type ItemPrevia struct {
	Linha                int
	Nome, CPF            string
	Cargo, Obra          string
	AdmitidoEm           string
	Situacao             string // NOVO | JA_EXISTE
	CriaCargo, CriaObra bool
}

type Previa struct {
	Token                                  string
	Itens                                  []ItemPrevia
	Novos, JaExistem                       int
	CargosNovos, ObrasNovas                []string
	SemAdmissao                            int
	Ignoradas                              []planilha.LinhaFuncionarioIgnorada
	ColunasReconhecidas, ColunasIgnoradas []string
}

type ResumoImportacaoFuncionarios struct {
	Criados, Pulados, CargosCriados, ObrasCriadas int
}

func gerarToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (g *GerenciadorImportacao) purgarExpiradas() {
	agora := time.Now()
	for t, c := range g.cache {
		if agora.After(c.expiraEm) {
			delete(g.cache, t)
		}
	}
}

// GerarPrevia lê a planilha e diz o que vai acontecer — sem gravar nada. COMPORTAMENTO.md §5.
func (g *GerenciadorImportacao) GerarPrevia(ctx context.Context, arquivo io.Reader) (*Previa, error) {
	leitura, err := planilha.LerPlanilhaFuncionarios(arquivo)
	if err != nil {
		return nil, erroValidacao(err.Error())
	}

	cargosNoBanco, err := g.mapaCargos(ctx)
	if err != nil {
		return nil, err
	}
	obrasNoBanco, err := g.mapaObras(ctx)
	if err != nil {
		return nil, err
	}

	cargosNovos := map[string]bool{}
	obrasNovas := map[string]bool{}
	var ordemCargos, ordemObras []string

	itens := make([]ItemPrevia, 0, len(leitura.Linhas))
	semAdmissao := 0
	for _, l := range leitura.Linhas {
		if l.AdmitidoEm == nil {
			semAdmissao++
		}

		existente, err := g.Funcionarios.BuscarPorCPF(ctx, l.CPF)
		if err != nil {
			return nil, err
		}
		jaExiste := existente != nil

		item := ItemPrevia{Linha: l.Linha, Nome: l.Nome, CPF: dominio.FormatarCPF(l.CPF)}
		if l.Cargo != nil {
			item.Cargo = *l.Cargo
			item.CriaCargo = !cargosNoBanco[dominio.NormalizarChave(*l.Cargo)]
		}
		if l.Obra != nil {
			item.Obra = *l.Obra
			item.CriaObra = !obrasNoBanco[dominio.NormalizarChave(*l.Obra)]
		}
		if l.AdmitidoEm != nil {
			item.AdmitidoEm = l.AdmitidoEm.Format("02/01/2006")
		}

		if jaExiste {
			item.Situacao = "JA_EXISTE"
		} else {
			item.Situacao = "NOVO"
			if item.CriaCargo && !cargosNovos[dominio.NormalizarChave(*l.Cargo)] {
				cargosNovos[dominio.NormalizarChave(*l.Cargo)] = true
				ordemCargos = append(ordemCargos, *l.Cargo)
			}
			if item.CriaObra && !obrasNovas[dominio.NormalizarChave(*l.Obra)] {
				obrasNovas[dominio.NormalizarChave(*l.Obra)] = true
				ordemObras = append(ordemObras, *l.Obra)
			}
		}
		itens = append(itens, item)
	}

	novos, jaExistem := 0, 0
	for _, i := range itens {
		if i.Situacao == "NOVO" {
			novos++
		} else {
			jaExistem++
		}
	}

	sort.Strings(ordemCargos)
	sort.Strings(ordemObras)

	g.mu.Lock()
	if g.cache == nil {
		g.cache = map[string]previaCache{}
	}
	g.purgarExpiradas()
	token := gerarToken()
	g.cache[token] = previaCache{linhas: leitura.Linhas, expiraEm: time.Now().Add(ttlPrevia)}
	g.mu.Unlock()

	return &Previa{
		Token: token, Itens: itens, Novos: novos, JaExistem: jaExistem,
		CargosNovos: ordemCargos, ObrasNovas: ordemObras, SemAdmissao: semAdmissao,
		Ignoradas: leitura.Ignoradas, ColunasReconhecidas: leitura.ColunasReconhecidas, ColunasIgnoradas: leitura.ColunasIgnoradas,
	}, nil
}

func (g *GerenciadorImportacao) mapaCargos(ctx context.Context) (map[string]bool, error) {
	cargos, err := g.Cargos.Listar(ctx)
	if err != nil {
		return nil, err
	}
	m := map[string]bool{}
	for _, c := range cargos {
		m[dominio.NormalizarChave(c.Nome)] = true
	}
	return m, nil
}

func (g *GerenciadorImportacao) mapaObras(ctx context.Context) (map[string]bool, error) {
	m := map[string]bool{}
	if g.ListarObras == nil {
		return m, nil
	}
	obras, err := g.ListarObras(ctx)
	if err != nil {
		return nil, err
	}
	for _, o := range obras {
		m[dominio.NormalizarChave(o.Codigo)] = true
		m[dominio.NormalizarChave(o.Descricao)] = true
	}
	return m, nil
}

// Confirmar grava o que a prévia mostrou — COMPORTAMENTO.md §5. A prévia é de uso único: some
// do cache no primeiro Confirmar (ou expira sozinha), então reenviar o mesmo token duas vezes
// não duplica nada — o segundo pedido cai no erro de token ausente.
func (g *GerenciadorImportacao) Confirmar(ctx context.Context, token, registradoPor string) (*ResumoImportacaoFuncionarios, error) {
	g.mu.Lock()
	cache, ok := g.cache[token]
	if ok {
		delete(g.cache, token)
	}
	g.purgarExpiradas()
	g.mu.Unlock()

	if !ok || time.Now().After(cache.expiraEm) {
		return nil, erroValidacao("A prévia expirou ou já foi usada. Selecione a planilha de novo.")
	}
	linhas := cache.linhas

	var novos []planilha.LinhaFuncionarioImportado
	for _, l := range linhas {
		existente, err := g.Funcionarios.BuscarPorCPF(ctx, l.CPF)
		if err != nil {
			return nil, err
		}
		if existente == nil {
			novos = append(novos, l)
		}
	}
	if len(novos) == 0 {
		return nil, erroValidacao("Nenhum funcionário novo na planilha — todos os CPFs já estão no RH.")
	}

	cargos, err := g.Cargos.Listar(ctx)
	if err != nil {
		return nil, err
	}
	cargoPorNome := map[string]string{}
	for _, c := range cargos {
		cargoPorNome[dominio.NormalizarChave(c.Nome)] = c.ID
	}

	var obras []OpcaoObraImportacao
	if g.ListarObras != nil {
		obras, err = g.ListarObras(ctx)
		if err != nil {
			return nil, err
		}
	}
	obraPorChave := map[string]string{}
	for _, o := range obras {
		obraPorChave[dominio.NormalizarChave(o.Codigo)] = o.ID
		obraPorChave[dominio.NormalizarChave(o.Descricao)] = o.ID
	}

	cargosCriados, obrasCriadas := 0, 0

	// Cargos e obras entram antes, fora do laço de pessoas — evita a mesma obra ser criada
	// duas vezes quando dois funcionários da mesma obra caem na mesma leva (mesmo motivo do
	// Next.js).
	for _, l := range novos {
		if l.Cargo != nil {
			chave := dominio.NormalizarChave(*l.Cargo)
			if _, existe := cargoPorNome[chave]; !existe {
				c := &dominio.Cargo{Nome: strings.TrimSpace(*l.Cargo), Risco: dominio.RiscoNormal}
				if err := g.Cargos.Criar(ctx, c); err != nil {
					return nil, err
				}
				cargoPorNome[chave] = c.ID
				cargosCriados++
			}
		}
		if l.Obra != nil && g.CriarObra != nil {
			chave := dominio.NormalizarChave(*l.Obra)
			if _, existe := obraPorChave[chave]; !existe {
				nome := strings.TrimSpace(*l.Obra)
				codigo := nome
				if len(codigo) > 20 {
					codigo = codigo[:20]
				}
				codigo = strings.ToUpper(codigo)
				id, err := g.CriarObra(ctx, nome, codigo, nome)
				if err != nil {
					return nil, err
				}
				obraPorChave[chave] = id
				obraPorChave[dominio.NormalizarChave(codigo)] = id
				obrasCriadas++
			}
		}
	}

	// Matrícula sequencial calculada UMA vez fora do laço — chamar UltimaMatricula a cada
	// linha devolveria a mesma matrícula pra todas antes de qualquer gravação (mesmo motivo
	// documentado em actions/importar-funcionarios.ts).
	ultima, err := g.Funcionarios.UltimaMatricula(ctx)
	if err != nil {
		return nil, err
	}
	proximo := 1
	if ultima != "" {
		digitos := reDigitosMatricula.ReplaceAllString(ultima, "")
		if n, err := strconv.Atoi(digitos); err == nil {
			proximo = n + 1
		}
	}

	hoje := time.Now().UTC()
	hoje = time.Date(hoje.Year(), hoje.Month(), hoje.Day(), 0, 0, 0, 0, time.UTC)

	criados := 0
	for _, l := range novos {
		matricula := ""
		if l.Matricula != nil && strings.TrimSpace(*l.Matricula) != "" {
			matricula = strings.TrimSpace(*l.Matricula)
		} else {
			matricula = fmt.Sprintf("SC-%04d", proximo)
			proximo++
		}

		admitidoEm := hoje
		if l.AdmitidoEm != nil {
			admitidoEm = *l.AdmitidoEm
		}

		var cargoID, obraID *string
		if l.Cargo != nil {
			if id, ok := cargoPorNome[dominio.NormalizarChave(*l.Cargo)]; ok {
				cargoID = &id
			}
		}
		if l.Obra != nil {
			if id, ok := obraPorChave[dominio.NormalizarChave(*l.Obra)]; ok {
				obraID = &id
			}
		}

		status := l.Status
		if status == "" {
			status = dominio.StatusAtivo
		}
		tipoContrato := "CLT"
		if l.TipoContrato != nil && strings.TrimSpace(*l.TipoContrato) != "" {
			tipoContrato = strings.ToUpper(strings.TrimSpace(*l.TipoContrato))
		}

		f := &dominio.Funcionario{
			Nome: l.Nome, CPF: l.CPF, Matricula: matricula, AdmitidoEm: admitidoEm,
			Status: status, TipoContrato: tipoContrato,
			RG: l.RG, DataNascimento: l.DataNascimento, Sexo: l.Sexo,
			Telefone: l.Telefone, Email: l.Email, Cidade: l.Cidade, UF: ufMaiuscula(l.UF),
			Salario: l.Salario, TamanhoCamisa: l.TamanhoCamisa, TamanhoCalca: l.TamanhoCalca, TamanhoCalcado: l.TamanhoCalcado,
			CargoID: cargoID, ObraID: obraID,
		}
		detalhe := fmt.Sprintf("Linha %d da planilha", l.Linha)
		evento := &dominio.Evento{
			Tipo: dominio.EventoAdmissao, DescricaoHumana: "Cadastro importado de planilha",
			Detalhe: &detalhe, OcorridoEm: admitidoEm, RegistradoPor: ponteiro(registradoPor), ObraID: obraID,
		}

		if err := g.Funcionarios.Criar(ctx, f, evento); err != nil {
			// Matrícula repetida ou CPF que entrou entre a leitura e a gravação: a linha é
			// pulada em vez de derrubar a importação inteira — mesma decisão do Next.js.
			continue
		}
		criados++
	}

	return &ResumoImportacaoFuncionarios{
		Criados: criados, Pulados: len(linhas) - criados, CargosCriados: cargosCriados, ObrasCriadas: obrasCriadas,
	}, nil
}

func ufMaiuscula(uf *string) *string {
	if uf == nil {
		return nil
	}
	v := strings.ToUpper(strings.TrimSpace(*uf))
	if len(v) > 2 {
		v = v[:2]
	}
	if v == "" {
		return nil
	}
	return &v
}
