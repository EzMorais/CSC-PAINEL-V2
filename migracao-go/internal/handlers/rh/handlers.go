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
	"siqueiracampos/servidor/internal/services/integracao"
)

type Handlers struct {
	Sessoes          *middleware.Sessoes
	Cargos           *aplicacao.GerenciadorCargos
	Departamentos    *aplicacao.GerenciadorDepartamentos
	Funcionarios     *aplicacao.GerenciadorFuncionarios
	Dashboard        *aplicacao.GerenciadorDashboard
	Treinamentos     *aplicacao.GerenciadorTreinamentos
	Uniformes        *aplicacao.GerenciadorUniformes
	Exames           *aplicacao.GerenciadorExames
	Documentos       *aplicacao.GerenciadorDocumentos
	Auditorias       *aplicacao.GerenciadorAuditorias
	NaoConformidades *aplicacao.GerenciadorNaoConformidades
	Epi              *aplicacao.GerenciadorEpi
	Relatorios       *aplicacao.GerenciadorRelatorios
	Importacao       *aplicacao.GerenciadorImportacao

	RepoCargos        dominio.CargoRepositorio
	RepoDepartamentos dominio.DepartamentoRepositorio
	RepoFuncionarios  dominio.FuncionarioRepositorio
	RepoDependentes   dominio.DependenteRepositorio
	RepoEventos       dominio.EventoRepositorio
	RepoTreinamentos  dominio.TreinamentoRepositorio

	// Integracao verifica o token de máquina das rotas /api/integracao/... (COMPORTAMENTO.md
	// §6) — mesmo serviço usado pelo internal/infrastructure/clienterh do lado do Almoxarifado.
	Integracao *integracao.Servico
	// URLEstoque alimenta o link externo de /rh/epis pro Almoxarifado (COMPORTAMENTO.md §6).
	URLEstoque string

	// ContarObrasAtivas e ListarObrasAtivas evitam este pacote importar domain/cadastro —
	// mesma decisão do pacote application/rh (ver funcionarios.go ResolverObraCodigo).
	ContarObrasAtivas func(ctx context.Context) (int, error)
	ListarObrasAtivas func(ctx context.Context) ([]OpcaoObra, error)
	// ListarObrasFn devolve TODAS as obras (ativas e inativas), pra /rh/obras — só leitura,
	// mesmo motivo de COMPORTAMENTO.md §2 ("RH não tem tela de criar/editar Obra"). Nome com
	// sufixo Fn porque o método HTTP ListarObras (obras.go) já ocupa esse nome no mesmo tipo.
	ListarObrasFn func(ctx context.Context) ([]ObraListagem, error)
}

type OpcaoObra struct{ ID, Codigo string }

type ObraListagem struct {
	ID, Codigo, Descricao, Cliente string
	Responsavel                    *string
	Ativa                          bool
}

// Novo recebe a struct já preenchida (campos nomeados no site de chamada, em
// cmd/servidor/main.go) — em vez de uma lista posicional de ~15 parâmetros, fácil de
// trocar de ordem por engano à medida que o módulo cresce.
func Novo(h Handlers) *Handlers {
	return &h
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
