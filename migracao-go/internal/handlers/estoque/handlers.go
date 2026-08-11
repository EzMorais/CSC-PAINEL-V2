// Package estoque contém os handlers HTTP do Almoxarifado — ver
// migracao-go/estoque/COMPORTAMENTO.md. Montado sob o prefixo /almoxarifado no binário único.
package estoque

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/estoque"
	"siqueiracampos/servidor/internal/domain/cadastro"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
)

type Handlers struct {
	Sessoes       *middleware.Sessoes
	Materiais     *aplicacao.GerenciadorMateriais
	Movimentacoes *aplicacao.GerenciadorMovimentacoes
	Solicitacoes  *aplicacao.GerenciadorSolicitacoes
	Aprovacoes    *aplicacao.GerenciadorAprovacoes
	Configuracao  *aplicacao.GerenciadorConfiguracaoEmail
	Dashboard     *aplicacao.GerenciadorDashboard

	RepoMateriais     dominio.MaterialRepositorio
	RepoMovimentacoes dominio.MovimentacaoRepositorio
	RepoSolicitacoes  dominio.SolicitacaoRepositorio
	RepoAprovacoes    dominio.AprovacaoRepositorio
	RepoObras         cadastro.ObraRepositorio
	RepoFornecedores  cadastro.FornecedorRepositorio
}

func Novo(
	sessoes *middleware.Sessoes,
	materiais *aplicacao.GerenciadorMateriais,
	movimentacoes *aplicacao.GerenciadorMovimentacoes,
	solicitacoes *aplicacao.GerenciadorSolicitacoes,
	aprovacoes *aplicacao.GerenciadorAprovacoes,
	configuracao *aplicacao.GerenciadorConfiguracaoEmail,
	dashboard *aplicacao.GerenciadorDashboard,
	repoMateriais dominio.MaterialRepositorio,
	repoMovimentacoes dominio.MovimentacaoRepositorio,
	repoSolicitacoes dominio.SolicitacaoRepositorio,
	repoAprovacoes dominio.AprovacaoRepositorio,
	repoObras cadastro.ObraRepositorio,
	repoFornecedores cadastro.FornecedorRepositorio,
) *Handlers {
	return &Handlers{
		Sessoes: sessoes, Materiais: materiais, Movimentacoes: movimentacoes,
		Solicitacoes: solicitacoes, Aprovacoes: aprovacoes, Configuracao: configuracao, Dashboard: dashboard,
		RepoMateriais: repoMateriais, RepoMovimentacoes: repoMovimentacoes, RepoSolicitacoes: repoSolicitacoes,
		RepoAprovacoes: repoAprovacoes, RepoObras: repoObras, RepoFornecedores: repoFornecedores,
	}
}

// sessao é o piso de toda rota do módulo — sessão válida E módulo liberado pro Portal
// (identidade.TemAcesso). Mesmo padrão de financeiro.go e programacao.go.
func (h *Handlers) sessao(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.TemAcesso(*sess, identidade.ModuloEstoque) {
		http.Error(w, "Acesso ao Almoxarifado não liberado.", http.StatusForbidden)
		return nil, false
	}
	return sess, true
}

// exigirLancamento é o piso de toda escrita — ver COMPORTAMENTO.md §1: sessão válida E
// cargo com permissão de lançar (ADMIN/OPERACIONAL/GERENTE).
func (h *Handlers) exigirLancamento(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	sess, ok := h.sessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.PodeLancar(sess.Cargo) {
		http.Error(w, "Seu cargo permite apenas consultar. Para lançar no almoxarifado, peça ao administrador para mudar seu cargo no Portal.", http.StatusForbidden)
		return nil, false
	}
	return sess, true
}
