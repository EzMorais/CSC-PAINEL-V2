package financeiro

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	aplicacao "siqueiracampos/servidor/internal/application/financeiro"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
	tpl "siqueiracampos/servidor/templates/financeiro"
)

type Handlers struct {
	Sessoes   *middleware.Sessoes
	Operacoes *aplicacao.GerenciadorOperacional
	Baixas    *aplicacao.GerenciadorBaixas
	Repo      dominio.OperacaoRepositorio
}

func Novo(s *middleware.Sessoes, o *aplicacao.GerenciadorOperacional, b *aplicacao.GerenciadorBaixas, r dominio.OperacaoRepositorio) *Handlers {
	return &Handlers{Sessoes: s, Operacoes: o, Baixas: b, Repo: r}
}

func (h *Handlers) sessao(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	s, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.TemAcesso(*s, identidade.ModuloFinanceiro) {
		http.Error(w, "Acesso ao Financeiro não liberado.", http.StatusForbidden)
		return nil, false
	}
	return s, true
}
func (h *Handlers) lancamento(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	s, ok := h.sessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.FinanceiroPodeLancar(*s) {
		http.Error(w, "Seu cargo permite apenas consultar.", http.StatusForbidden)
		return nil, false
	}
	return s, true
}

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	res, err := h.Repo.Resumo(r.Context(), time.Now())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	contas, _ := h.Repo.ListarContas(r.Context())
	integracoes, _ := h.Repo.ListarIntegracoesFiscais(r.Context())
	var fechamentos []dominio.Fechamento
	if repo, ok := h.Repo.(dominio.FechamentoRepositorio); ok {
		fechamentos, _ = repo.ListarFechamentos(r.Context())
	}
	tpl.Dashboard(res, contas, integracoes, fechamentos).Render(r.Context(), w)
}
func (h *Handlers) Faturamentos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	itens, err := h.Repo.ListarFaturamentos(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	tpl.Faturamento(itens, time.Now().Format(time.DateOnly), uuid.NewString()).Render(r.Context(), w)
}
func (h *Handlers) FaturamentoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	modelo := r.PostFormValue("modeloFiscal")
	emissor := "SEFAZ"
	if modelo == "NFSE" {
		emissor = "NFSE_NACIONAL"
	}
	if modelo == "SEM_NOTA" {
		emissor = "EXTERNO"
	}
	_, err := h.Operacoes.CriarFaturamento(r.Context(), *s, aplicacao.EntradaFaturamento{ClienteNome: r.PostFormValue("clienteNome"), Descricao: r.PostFormValue("descricao"), TipoOperacao: r.PostFormValue("tipoOperacao"), Emissao: r.PostFormValue("emissao"), Vencimento: r.PostFormValue("vencimento"), ValorBruto: r.PostFormValue("valorBruto"), Desconto: r.PostFormValue("desconto"), Acrescimo: r.PostFormValue("acrescimo"), ModeloFiscal: modelo, EmissorFiscal: emissor, Observacao: r.PostFormValue("observacao"), ChaveIdempotencia: r.PostFormValue("chaveIdempotencia")})
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/faturamento", 303)
}
func (h *Handlers) Faturar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	if err := h.Operacoes.Faturar(r.Context(), *s, r.PathValue("id")); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/faturamento", 303)
}
func (h *Handlers) Fiscal(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	docs, err := h.Repo.ListarDocumentosFiscais(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	tpl.Fiscal(docs).Render(r.Context(), w)
}
func (h *Handlers) ImportarSebrae(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	if _, err := h.Operacoes.ImportarSebrae(r.Context(), *s, r.PostFormValue("xml"), r.PostFormValue("vencimento")); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/fiscal", 303)
}
func (h *Handlers) FiscalResultado(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	if err := h.Operacoes.RegistrarResultadoFiscal(r.Context(), *s, r.PathValue("id"), r.PostFormValue("status"), r.PostFormValue("chave"), r.PostFormValue("protocolo"), r.PostFormValue("xml"), r.PostFormValue("erro")); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/fiscal", 303)
}
func (h *Handlers) contas(w http.ResponseWriter, r *http.Request, tipo dominio.TipoTitulo, aba string) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	titulos, err := h.Repo.ListarTitulos(r.Context(), tipo)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	contas, _ := h.Repo.ListarContas(r.Context())
	tpl.Titulos(aba, tipo, titulos, contas, time.Now().Format(time.DateOnly), uuid.NewString()).Render(r.Context(), w)
}
func (h *Handlers) ContasPagar(w http.ResponseWriter, r *http.Request) {
	h.contas(w, r, dominio.TituloPagar, "pagar")
}
func (h *Handlers) ContasReceber(w http.ResponseWriter, r *http.Request) {
	h.contas(w, r, dominio.TituloReceber, "receber")
}
func (h *Handlers) TituloCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	_, err := h.Operacoes.CriarTitulo(r.Context(), *s, aplicacao.EntradaTitulo{Tipo: r.PostFormValue("tipo"), ContraparteNome: r.PostFormValue("contraparteNome"), Descricao: r.PostFormValue("descricao"), Emissao: r.PostFormValue("emissao"), Vencimento: r.PostFormValue("vencimento"), Valor: r.PostFormValue("valor")})
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/"+retorno(r), 303)
}
func (h *Handlers) TituloAprovar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if err := h.Operacoes.AprovarTitulo(r.Context(), *s, r.PathValue("id")); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/"+retorno(r), 303)
}
func moedaCentavos(v string) string {
	n, err := aplicacao.ParseCentavos(v, false)
	if err != nil {
		return "inválido"
	}
	return strconv.FormatInt(int64(n), 10)
}
func (h *Handlers) TituloBaixar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.lancamento(w, r)
	if !ok {
		return
	}
	_, err := h.Baixas.Registrar(r.Context(), aplicacao.EntradaBaixa{TituloID: r.PathValue("id"), ParcelaID: r.PostFormValue("parcelaID"), ContaID: r.PostFormValue("contaID"), ValorCentavos: moedaCentavos(r.PostFormValue("valor")), OcorridoEm: r.PostFormValue("ocorridoEm"), Documento: r.PostFormValue("documento"), Observacao: r.PostFormValue("observacao"), ChaveIdempotencia: r.PostFormValue("chaveIdempotencia"), RegistradoPor: s.Nome, RegistradoPorID: s.ID})
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro/"+retorno(r), 303)
}

func (h *Handlers) MovimentoEstornar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if !identidade.FinanceiroPodeAprovar(*s) {
		http.Error(w, "estorno exige aprovador financeiro", http.StatusForbidden)
		return
	}
	_, err := h.Baixas.Estornar(r.Context(), aplicacao.EntradaEstorno{
		MovimentoID:       r.PathValue("id"),
		ChaveIdempotencia: r.PostFormValue("chaveIdempotencia"),
		Observacao:        r.PostFormValue("observacao"),
		RegistradoPor:     s.Nome,
		RegistradoPorID:   s.ID,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	destino := "/financeiro"
	if tipo := strings.ToUpper(strings.TrimSpace(r.PostFormValue("tipo"))); tipo == string(dominio.TituloPagar) {
		destino = "/financeiro/contas-pagar"
	} else if tipo == string(dominio.TituloReceber) {
		destino = "/financeiro/contas-receber"
	}
	http.Redirect(w, r, destino, http.StatusSeeOther)
}

func (h *Handlers) FecharCompetencia(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if !identidade.FinanceiroPodeAdministrar(*s) {
		http.Error(w, "somente administração fecha competência", http.StatusForbidden)
		return
	}
	repo, ok := h.Repo.(dominio.FechamentoRepositorio)
	if !ok {
		http.Error(w, "fechamento financeiro indisponível", http.StatusNotImplemented)
		return
	}
	if err := repo.FecharCompetencia(r.Context(), r.PostFormValue("competencia"), s.ID, s.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/financeiro", http.StatusSeeOther)
}

func (h *Handlers) ReabrirCompetencia(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if !identidade.FinanceiroPodeAdministrar(*s) {
		http.Error(w, "somente administração reabre competência", http.StatusForbidden)
		return
	}
	repo, ok := h.Repo.(dominio.FechamentoRepositorio)
	if !ok {
		http.Error(w, "fechamento financeiro indisponível", http.StatusNotImplemented)
		return
	}
	if err := repo.ReabrirCompetencia(r.Context(), r.PathValue("competencia"), s.ID, s.Nome, r.PostFormValue("justificativa")); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/financeiro", http.StatusSeeOther)
}
func (h *Handlers) ContaCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if err := h.Operacoes.CriarConta(r.Context(), *s, r.PostFormValue("nome"), r.PostFormValue("tipo")); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	http.Redirect(w, r, "/financeiro", 303)
}
func retorno(r *http.Request) string {
	v := r.PostFormValue("retorno")
	if v != "contas-pagar" && v != "contas-receber" {
		return ""
	}
	return v
}
