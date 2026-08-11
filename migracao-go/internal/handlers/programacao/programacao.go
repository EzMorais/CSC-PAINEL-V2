package programacao

import (
	"net/http"
	"strconv"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/programacao"
	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
	"siqueiracampos/servidor/internal/middleware"
	tpl "siqueiracampos/servidor/templates/programacao"
)

type Handlers struct {
	Sessoes     *middleware.Sessoes
	Gerenciador *aplicacao.Gerenciador
	Repo        dominio.Repositorio
}

func Novo(s *middleware.Sessoes, g *aplicacao.Gerenciador, r dominio.Repositorio) *Handlers {
	return &Handlers{Sessoes: s, Gerenciador: g, Repo: r}
}

func (h *Handlers) sessao(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	s, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.TemAcesso(*s, identidade.ModuloProgramacao) {
		http.Error(w, "Acesso à Programação Diária não liberado.", http.StatusForbidden)
		return nil, false
	}
	return s, true
}

func erro(w http.ResponseWriter, e error) { http.Error(w, e.Error(), http.StatusBadRequest) }

func redirecionarDia(w http.ResponseWriter, r *http.Request, dataIso string) {
	http.Redirect(w, r, "/programacao/dia/"+dataIso, http.StatusFound)
}

// ── Dia / quadro ─────────────────────────────────────────────────────────────────────────

func (h *Handlers) Hoje(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	http.Redirect(w, r, "/programacao/dia/"+time.Now().UTC().Format(time.DateOnly), http.StatusFound)
}

func (h *Handlers) DiaPagina(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	data, err := time.Parse(time.DateOnly, r.PathValue("data"))
	if err != nil {
		http.NotFound(w, r)
		return
	}

	p, err := h.Repo.ProgramacaoDoDia(r.Context(), data)
	if err != nil {
		erro(w, err)
		return
	}
	frentes, err := h.Repo.ListarFrentes(r.Context(), true)
	if err != nil {
		erro(w, err)
		return
	}
	funcoes, err := h.Repo.ListarFuncoes(r.Context(), true)
	if err != nil {
		erro(w, err)
		return
	}
	funcionarios, err := h.Repo.ListarFuncionarios(r.Context(), true)
	if err != nil {
		erro(w, err)
		return
	}

	var conflitos []dominio.Conflito
	if p != nil {
		conflitos, err = h.Gerenciador.ConferirQuadroDoDia(r.Context(), p)
		if err != nil {
			erro(w, err)
			return
		}
	}
	tpl.Dia(data, p, frentes, funcoes, funcionarios, conflitos).Render(r.Context(), w)
}

func (h *Handlers) DiaCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PathValue("data")
	if _, err := h.Gerenciador.CriarDia(r.Context(), *s, dataIso); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

func (h *Handlers) DiaCopiar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PathValue("data")
	if _, _, err := h.Gerenciador.CopiarDe(r.Context(), *s, dataIso, r.PostFormValue("origem")); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

func (h *Handlers) DiaPublicar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PathValue("data")
	if err := h.Gerenciador.Publicar(r.Context(), *s, dataIso); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

// ── Escalas ──────────────────────────────────────────────────────────────────────────────

func (h *Handlers) EscalarCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	data := r.PostFormValue("data")
	_, err := h.Gerenciador.Escalar(r.Context(), *s, aplicacao.EntradaEscala{
		Data: data, FrenteID: r.PostFormValue("frenteId"), Nome: r.PostFormValue("nome"),
		FuncionarioID: r.PostFormValue("funcionarioId"), FuncionarioLocalID: r.PostFormValue("funcionarioLocalId"),
		FuncaoSigla: r.PostFormValue("funcaoSigla"),
	})
	if err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, data)
}

func (h *Handlers) EscalaMover(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PostFormValue("dataIso")
	if err := h.Gerenciador.MoverEscala(r.Context(), *s, r.PathValue("id"), r.PostFormValue("frenteId")); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

func (h *Handlers) EscalaTirar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PostFormValue("dataIso")
	if err := h.Gerenciador.TirarEscala(r.Context(), *s, r.PathValue("id")); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

// ── Recursos (veículos, máquinas, avisos) ───────────────────────────────────────────────

func (h *Handlers) RecursoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	data := r.PostFormValue("data")
	destaque, _ := strconv.ParseBool(r.PostFormValue("destaque"))
	_, err := h.Gerenciador.AdicionarRecurso(r.Context(), *s, aplicacao.EntradaRecurso{
		Data: data, FrenteID: r.PostFormValue("frenteId"), Tipo: r.PostFormValue("tipo"),
		Descricao: r.PostFormValue("descricao"), Placa: r.PostFormValue("placa"),
		MotoristaNome: r.PostFormValue("motoristaNome"), VeiculoLocalID: r.PostFormValue("veiculoLocalId"),
		Destaque: destaque,
	})
	if err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, data)
}

func (h *Handlers) RecursoTirar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	dataIso := r.PostFormValue("dataIso")
	if err := h.Gerenciador.TirarRecurso(r.Context(), *s, r.PathValue("id")); err != nil {
		erro(w, err)
		return
	}
	redirecionarDia(w, r, dataIso)
}

// ── Frentes ──────────────────────────────────────────────────────────────────────────────

func (h *Handlers) Frentes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	lista, err := h.Repo.ListarFrentes(r.Context(), false)
	if err != nil {
		erro(w, err)
		return
	}
	tpl.Frentes(lista).Render(r.Context(), w)
}

func (h *Handlers) FrenteCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	_, err := h.Gerenciador.CriarFrente(r.Context(), *s, aplicacao.EntradaFrente{
		Nome: r.PostFormValue("nome"), Cor: r.PostFormValue("cor"), Logo: r.PostFormValue("logo"),
		ObraCodigo: r.PostFormValue("obraCodigo"), Colunas: r.PostFormValue("colunas"),
	})
	if err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/frentes", http.StatusFound)
}

func (h *Handlers) FrenteAlternar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	ativa, _ := strconv.ParseBool(r.PostFormValue("ativa"))
	if err := h.Gerenciador.AlternarFrente(r.Context(), *s, r.PathValue("id"), ativa); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/frentes", http.StatusFound)
}

func (h *Handlers) FrenteMover(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if err := h.Gerenciador.MoverFrente(r.Context(), *s, r.PathValue("id"), r.PostFormValue("direcao")); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/frentes", http.StatusFound)
}

// ── Funcionários (cadastro local) ───────────────────────────────────────────────────────

func (h *Handlers) Funcionarios(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	lista, err := h.Repo.ListarFuncionarios(r.Context(), false)
	if err != nil {
		erro(w, err)
		return
	}
	funcoes, err := h.Repo.ListarFuncoes(r.Context(), true)
	if err != nil {
		erro(w, err)
		return
	}
	tpl.Funcionarios(lista, funcoes).Render(r.Context(), w)
}

func (h *Handlers) FuncionarioCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	motorista, _ := strconv.ParseBool(r.PostFormValue("motorista"))
	_, err := h.Gerenciador.CriarFuncionario(r.Context(), *s, aplicacao.EntradaFuncionario{
		Nome: r.PostFormValue("nome"), FuncaoSigla: r.PostFormValue("funcaoSigla"),
		Tipo: r.PostFormValue("tipo"), Motorista: motorista,
	})
	if err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/funcionarios", http.StatusFound)
}

func (h *Handlers) FuncionarioAlternarAtivo(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	ativo, _ := strconv.ParseBool(r.PostFormValue("ativo"))
	if err := h.Gerenciador.AlternarFuncionarioAtivo(r.Context(), *s, r.PathValue("id"), ativo); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/funcionarios", http.StatusFound)
}

func (h *Handlers) FuncionarioAlternarAusente(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	ausente, _ := strconv.ParseBool(r.PostFormValue("ausente"))
	if err := h.Gerenciador.AlternarFuncionarioAusente(r.Context(), *s, r.PathValue("id"), ausente, r.PostFormValue("observacao")); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/funcionarios", http.StatusFound)
}

// ── Veículos (cadastro local) ───────────────────────────────────────────────────────────

func (h *Handlers) Veiculos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	lista, err := h.Repo.ListarVeiculos(r.Context(), false)
	if err != nil {
		erro(w, err)
		return
	}
	tpl.Veiculos(lista).Render(r.Context(), w)
}

func (h *Handlers) VeiculoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	_, err := h.Gerenciador.CriarVeiculo(r.Context(), *s, aplicacao.EntradaVeiculo{
		Modelo: r.PostFormValue("modelo"), Placa: r.PostFormValue("placa"), MotoristaNome: r.PostFormValue("motoristaNome"),
	})
	if err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/veiculos", http.StatusFound)
}

func (h *Handlers) VeiculoAlternar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	ativo, _ := strconv.ParseBool(r.PostFormValue("ativo"))
	if err := h.Gerenciador.AlternarVeiculoAtivo(r.Context(), *s, r.PathValue("id"), ativo); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/veiculos", http.StatusFound)
}

// ── Funções ──────────────────────────────────────────────────────────────────────────────

func (h *Handlers) Funcoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	lista, err := h.Repo.ListarFuncoes(r.Context(), false)
	if err != nil {
		erro(w, err)
		return
	}
	tpl.Funcoes(lista).Render(r.Context(), w)
}

func (h *Handlers) FuncaoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	_, err := h.Gerenciador.CriarFuncao(r.Context(), *s, aplicacao.EntradaFuncao{
		Sigla: r.PostFormValue("sigla"), Nome: r.PostFormValue("nome"),
		CargoRH: r.PostFormValue("cargoRh"), Cor: r.PostFormValue("cor"),
	})
	if err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/funcoes", http.StatusFound)
}

func (h *Handlers) FuncaoAlternar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.sessao(w, r)
	if !ok {
		return
	}
	ativa, _ := strconv.ParseBool(r.PostFormValue("ativa"))
	if err := h.Gerenciador.AlternarFuncao(r.Context(), *s, r.PathValue("id"), ativa); err != nil {
		erro(w, err)
		return
	}
	http.Redirect(w, r, "/programacao/funcoes", http.StatusFound)
}
