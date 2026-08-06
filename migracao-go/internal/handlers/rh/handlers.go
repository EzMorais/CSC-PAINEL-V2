// Package rh contém os handlers HTTP do RH e SST — ver migracao-go/rh/COMPORTAMENTO.md.
// Montado sob o prefixo /rh no binário único (exceto as rotas de integração, que ficam SEM
// prefixo em /api/integracao/... — contrato externo com outros sistemas, ver §6).
package rh

import (
	"context"
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	"siqueiracampos/servidor/internal/middleware"
)

type Handlers struct {
	Sessoes       *middleware.Sessoes
	Cargos        *aplicacao.GerenciadorCargos
	Departamentos *aplicacao.GerenciadorDepartamentos
	Funcionarios  *aplicacao.GerenciadorFuncionarios
	Dashboard     *aplicacao.GerenciadorDashboard

	RepoCargos        dominio.CargoRepositorio
	RepoDepartamentos dominio.DepartamentoRepositorio
	RepoFuncionarios  dominio.FuncionarioRepositorio
	RepoDependentes   dominio.DependenteRepositorio
	RepoEventos       dominio.EventoRepositorio

	// ContarObrasAtivas evita este pacote importar domain/cadastro — mesma decisão do
	// pacote application/rh (ver funcionarios.go ResolverObraCodigo).
	ContarObrasAtivas func(ctx context.Context) (int, error)
	// ListarObrasAtivas alimenta o <select> de obra do formulário de funcionário.
	ListarObrasAtivas func(ctx context.Context) ([]OpcaoObra, error)
}

type OpcaoObra struct{ ID, Codigo string }

func Novo(
	sessoes *middleware.Sessoes,
	cargos *aplicacao.GerenciadorCargos,
	departamentos *aplicacao.GerenciadorDepartamentos,
	funcionarios *aplicacao.GerenciadorFuncionarios,
	dashboard *aplicacao.GerenciadorDashboard,
	repoCargos dominio.CargoRepositorio,
	repoDepartamentos dominio.DepartamentoRepositorio,
	repoFuncionarios dominio.FuncionarioRepositorio,
	repoDependentes dominio.DependenteRepositorio,
	repoEventos dominio.EventoRepositorio,
	contarObrasAtivas func(ctx context.Context) (int, error),
	listarObrasAtivas func(ctx context.Context) ([]OpcaoObra, error),
) *Handlers {
	return &Handlers{
		Sessoes: sessoes, Cargos: cargos, Departamentos: departamentos, Funcionarios: funcionarios, Dashboard: dashboard,
		RepoCargos: repoCargos, RepoDepartamentos: repoDepartamentos, RepoFuncionarios: repoFuncionarios,
		RepoDependentes: repoDependentes, RepoEventos: repoEventos,
		ContarObrasAtivas: contarObrasAtivas, ListarObrasAtivas: listarObrasAtivas,
	}
}

// exigirLancamento — piso de toda escrita. COMPORTAMENTO.md §1.
func (h *Handlers) exigirLancamento(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.PodeLancar(sess.Cargo) {
		http.Error(w, "Seu cargo permite apenas consultar. Para lançar, peça ao administrador para mudar seu cargo no Portal.", http.StatusForbidden)
		return nil, false
	}
	return sess, true
}

// exigirAdministracao — usada num único lugar: excluir funcionário. COMPORTAMENTO.md §1.
func (h *Handlers) exigirAdministracao(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.PodeAdministrar(sess.Cargo) {
		http.Error(w, "Só o administrador do sistema exclui um cadastro.", http.StatusForbidden)
		return nil, false
	}
	return sess, true
}
