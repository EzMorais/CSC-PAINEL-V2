// Package painel contém os handlers HTTP do Painel de Locação — ver
// migracao-go/painel/COMPORTAMENTO.md. Montado sob o prefixo /painel no binário único.
package painel

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/painel"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/painel"
	"siqueiracampos/servidor/internal/middleware"
)

type Handlers struct {
	Sessoes      *middleware.Sessoes
	Obras        *aplicacao.GerenciadorObras
	Fornecedores *aplicacao.GerenciadorFornecedores
	Locacoes     *aplicacao.GerenciadorLocacoes
	Importador   *aplicacao.Importador
	RepoObras    dominio.ObraRepositorio
	RepoForn     dominio.FornecedorRepositorio
	RepoLocacoes dominio.LocacaoRepositorio
	PastaUploads string
}

func Novo(
	sessoes *middleware.Sessoes,
	obras *aplicacao.GerenciadorObras,
	fornecedores *aplicacao.GerenciadorFornecedores,
	locacoes *aplicacao.GerenciadorLocacoes,
	importador *aplicacao.Importador,
	repoObras dominio.ObraRepositorio,
	repoForn dominio.FornecedorRepositorio,
	repoLocacoes dominio.LocacaoRepositorio,
	pastaUploads string,
) *Handlers {
	return &Handlers{
		Sessoes: sessoes, Obras: obras, Fornecedores: fornecedores, Locacoes: locacoes,
		Importador: importador, RepoObras: repoObras, RepoForn: repoForn, RepoLocacoes: repoLocacoes,
		PastaUploads: pastaUploads,
	}
}

// exigirLancamento é o piso de toda escrita — ver COMPORTAMENTO.md §1: sessão válida E
// cargo com permissão de lançar (ADMIN/OPERACIONAL/GERENTE). CONSULTA vê as telas mas
// qualquer ação de escrita recusa aqui.
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
