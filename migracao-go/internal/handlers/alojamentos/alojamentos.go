package alojamentos

import (
	"context"
	"net/http"
	"strconv"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/alojamentos"
	dominio "siqueiracampos/servidor/internal/domain/alojamentos"
	"siqueiracampos/servidor/internal/middleware"
	tpl "siqueiracampos/servidor/templates/alojamentos"
)

type Handlers struct {
	Sessoes            *middleware.Sessoes
	Gerenciador        *aplicacao.Gerenciador
	Repo               dominio.Repositorio
	ListarFuncionarios func(context.Context) ([]tpl.Opcao, error)
}

func (h *Handlers) sessao(w http.ResponseWriter, r *http.Request) (string, bool) {
	s, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return "", false
	}
	return s.Nome, true
}
func erro(w http.ResponseWriter, e error) { http.Error(w, e.Error(), http.StatusBadRequest) }
func boolForm(r *http.Request, n string) bool {
	v, _ := strconv.ParseBool(r.PostFormValue(n))
	return v
}
func (h *Handlers) opcoesAloj(ctx context.Context) []tpl.Opcao {
	xs, _ := h.Repo.ListarAlojamentos(ctx, true)
	o := make([]tpl.Opcao, len(xs))
	for i, x := range xs {
		o[i] = tpl.Opcao{ID: x.ID, Rotulo: x.Nome}
	}
	return o
}
func (h *Handlers) opcoesRotas(ctx context.Context) []tpl.Opcao {
	xs, _ := h.Repo.ListarRotas(ctx, true)
	o := make([]tpl.Opcao, len(xs))
	for i, x := range xs {
		o[i] = tpl.Opcao{ID: x.ID, Rotulo: x.Nome}
	}
	return o
}

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	i, e := h.Repo.Indicadores(r.Context())
	if e != nil {
		erro(w, e)
		return
	}
	hoje := time.Now()
	ps, _ := h.Repo.ListarProgramacao(r.Context(), hoje.AddDate(0, 0, -1), hoje.AddDate(0, 0, 14))
	ped, _ := h.Repo.ListarPedidos(r.Context(), "")
	if len(ped) > 5 {
		ped = ped[:5]
	}
	tpl.Dashboard(i, ps, ped).Render(r.Context(), w)
}
func (h *Handlers) Alojamentos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	xs, e := h.Repo.ListarAlojamentos(r.Context(), false)
	if e != nil {
		erro(w, e)
		return
	}
	tpl.ListaAlojamentos(xs).Render(r.Context(), w)
}
func entradaAloj(r *http.Request) aplicacao.EntradaAlojamento {
	return aplicacao.EntradaAlojamento{Nome: r.PostFormValue("nome"), CEP: r.PostFormValue("cep"), Logradouro: r.PostFormValue("logradouro"), Numero: r.PostFormValue("numero"), Cidade: r.PostFormValue("cidade"), UF: r.PostFormValue("uf"), Capacidade: r.PostFormValue("capacidade"), Responsavel: r.PostFormValue("responsavel"), Telefone: r.PostFormValue("telefone"), Observacoes: r.PostFormValue("observacoes")}
}
func (h *Handlers) AlojamentoCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	a, e := h.Gerenciador.SalvarAlojamento(r.Context(), "", entradaAloj(r))
	if e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+a.ID, http.StatusSeeOther)
}
func (h *Handlers) AlojamentoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	a, e := h.Repo.BuscarAlojamento(r.Context(), r.PathValue("id"))
	if e != nil || a == nil {
		http.NotFound(w, r)
		return
	}
	tpl.DetalheAlojamento(*a).Render(r.Context(), w)
}
func (h *Handlers) AlojamentoEditar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if _, e := h.Gerenciador.SalvarAlojamento(r.Context(), id, entradaAloj(r)); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+id, http.StatusSeeOther)
}
func (h *Handlers) AlojamentoAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if e := h.Repo.AlternarAlojamento(r.Context(), id, boolForm(r, "ativo")); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+id, http.StatusSeeOther)
}
func (h *Handlers) AlojamentoWhatsapp(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	v := r.PostFormValue("grupoId")
	var grupo *string
	if v != "" {
		grupo = &v
	}
	id := r.PathValue("id")
	if e := h.Repo.VincularGrupo(r.Context(), id, grupo); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+id, http.StatusSeeOther)
}
func (h *Handlers) QuartoCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if e := h.Gerenciador.CriarQuarto(r.Context(), aplicacao.EntradaQuarto{AlojamentoID: id, Numero: r.PostFormValue("numero"), Capacidade: r.PostFormValue("capacidade"), Tipo: r.PostFormValue("tipo")}); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+id, http.StatusSeeOther)
}
func (h *Handlers) QuartoAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	if e := h.Repo.AlternarQuarto(r.Context(), r.PathValue("id"), boolForm(r, "ativo")); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/cadastros/"+r.PostFormValue("alojamentoId"), http.StatusSeeOther)
}
func (h *Handlers) Moradores(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	xs, e := h.Repo.ListarAlocacoes(r.Context(), "")
	if e != nil {
		erro(w, e)
		return
	}
	fs, _ := h.ListarFuncionarios(r.Context())
	tpl.Moradores(xs, fs, h.opcoesAloj(r.Context()), h.opcoesRotas(r.Context())).Render(r.Context(), w)
}
func (h *Handlers) MoradorCriar(w http.ResponseWriter, r *http.Request) {
	user, ok := h.sessao(w, r)
	if !ok {
		return
	}
	fid := r.PostFormValue("funcionarioId")
	nome, mat := r.PostFormValue("funcionarioNome"), r.PostFormValue("matricula")
	if fs, e := h.ListarFuncionarios(r.Context()); e == nil {
		for _, f := range fs {
			if f.ID == fid {
				nome = f.Rotulo
				mat = f.Extra
			}
		}
	}
	e := h.Gerenciador.CriarAlocacao(r.Context(), aplicacao.EntradaAlocacao{FuncionarioID: fid, FuncionarioNome: nome, Matricula: mat, AlojamentoID: r.PostFormValue("alojamentoId"), QuartoID: r.PostFormValue("quartoId"), DataEntrada: r.PostFormValue("dataEntrada"), Transporte: r.PostFormValue("transporte"), RotaID: r.PostFormValue("rotaId"), Telefone: r.PostFormValue("telefone")}, user)
	if e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/moradores", http.StatusSeeOther)
}
func (h *Handlers) MoradorEncerrar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	if e := h.Gerenciador.Encerrar(r.Context(), r.PathValue("id"), r.PostFormValue("dataSaida"), r.PostFormValue("motivo")); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/moradores", http.StatusSeeOther)
}
func (h *Handlers) Pedidos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	xs, e := h.Repo.ListarPedidos(r.Context(), r.URL.Query().Get("status"))
	if e != nil {
		erro(w, e)
		return
	}
	tpl.Pedidos(xs, h.opcoesAloj(r.Context())).Render(r.Context(), w)
}
func (h *Handlers) PedidoCriar(w http.ResponseWriter, r *http.Request) {
	u, ok := h.sessao(w, r)
	if !ok {
		return
	}
	e := h.Gerenciador.CriarPedido(r.Context(), aplicacao.EntradaPedido{AlojamentoID: r.PostFormValue("alojamentoId"), Tipo: r.PostFormValue("tipo"), Titulo: r.PostFormValue("titulo"), Descricao: r.PostFormValue("descricao"), Prioridade: r.PostFormValue("prioridade")}, u)
	if e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/pedidos", http.StatusSeeOther)
}
func (h *Handlers) PedidoStatus(w http.ResponseWriter, r *http.Request) {
	u, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if e := h.Gerenciador.AtualizarPedido(r.Context(), r.PathValue("id"), r.PostFormValue("status"), r.PostFormValue("observacao"), u); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/pedidos", http.StatusSeeOther)
}
func (h *Handlers) Programacao(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	hoje := time.Now()
	xs, e := h.Repo.ListarProgramacao(r.Context(), hoje.AddDate(0, 0, -30), hoje.AddDate(0, 3, 0))
	if e != nil {
		erro(w, e)
		return
	}
	tpl.Programacao(xs, h.opcoesAloj(r.Context())).Render(r.Context(), w)
}
func (h *Handlers) ProgramacaoCriar(w http.ResponseWriter, r *http.Request) {
	u, ok := h.sessao(w, r)
	if !ok {
		return
	}
	e := h.Gerenciador.CriarProgramacao(r.Context(), aplicacao.EntradaProgramacao{Data: r.PostFormValue("data"), Tipo: r.PostFormValue("tipo"), Titulo: r.PostFormValue("titulo"), Horario: r.PostFormValue("horario"), AlojamentoID: r.PostFormValue("alojamentoId")}, u)
	if e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/programacao", http.StatusSeeOther)
}
func (h *Handlers) ProgramacaoExcluir(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	if e := h.Repo.ExcluirProgramacao(r.Context(), r.PathValue("id")); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/programacao", http.StatusSeeOther)
}
func (h *Handlers) Rotas(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	xs, e := h.Repo.ListarRotas(r.Context(), false)
	if e != nil {
		erro(w, e)
		return
	}
	tpl.Rotas(xs).Render(r.Context(), w)
}
func (h *Handlers) RotaCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	e := h.Gerenciador.CriarRota(r.Context(), aplicacao.EntradaRota{Nome: r.PostFormValue("nome"), Motorista: r.PostFormValue("motorista"), Veiculo: r.PostFormValue("veiculo"), HorarioIda: r.PostFormValue("horarioIda"), HorarioVolta: r.PostFormValue("horarioVolta"), Capacidade: r.PostFormValue("capacidade")})
	if e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/rotas", http.StatusSeeOther)
}
func (h *Handlers) RotaAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	if e := h.Repo.AlternarRota(r.Context(), r.PathValue("id"), boolForm(r, "ativo")); e != nil {
		erro(w, e)
		return
	}
	http.Redirect(w, r, "/alojamentos/rotas", http.StatusSeeOther)
}
