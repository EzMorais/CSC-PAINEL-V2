package programacao

import (
	"context"
	"fmt"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type EntradaFuncionario struct {
	Nome, FuncaoSigla, Foto, Tipo string
	Motorista                     bool
}

func (g *Gerenciador) CriarFuncionario(ctx context.Context, s identidade.Sessao, e EntradaFuncionario) (*dominio.Funcionario, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não cadastra funcionários")
	}
	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return nil, fmt.Errorf("informe o nome")
	}
	tipo := strings.ToUpper(strings.TrimSpace(e.Tipo))
	if tipo != "CSC" && tipo != "PRESTADOR" {
		tipo = "CSC"
	}
	f := &dominio.Funcionario{
		Nome: nome, FuncaoSigla: strPtr(e.FuncaoSigla), Foto: strPtr(e.Foto),
		Motorista: e.Motorista, Tipo: tipo, Ativo: true,
	}
	if err := g.Repo.CriarFuncionario(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (g *Gerenciador) EditarFuncionario(ctx context.Context, s identidade.Sessao, id string, e EntradaFuncionario) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não edita funcionários")
	}
	atual, err := g.Repo.BuscarFuncionario(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("funcionário não encontrado")
	}
	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return fmt.Errorf("informe o nome")
	}
	tipo := strings.ToUpper(strings.TrimSpace(e.Tipo))
	if tipo != "CSC" && tipo != "PRESTADOR" {
		tipo = "CSC"
	}
	atual.Nome, atual.Tipo, atual.Motorista = nome, tipo, e.Motorista
	atual.FuncaoSigla, atual.Foto = strPtr(e.FuncaoSigla), strPtr(e.Foto)
	return g.Repo.AtualizarFuncionario(ctx, atual)
}

func (g *Gerenciador) AlternarFuncionarioAtivo(ctx context.Context, s identidade.Sessao, id string, ativo bool) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não altera funcionários")
	}
	return g.Repo.AlternarFuncionarioAtivo(ctx, id, ativo)
}

// AlternarFuncionarioAusente marca a pessoa como ausente/de férias hoje — some da lista de
// disponíveis e não entra em "copiar do dia anterior" enquanto durar.
func (g *Gerenciador) AlternarFuncionarioAusente(ctx context.Context, s identidade.Sessao, id string, ausente bool, obs string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não altera funcionários")
	}
	return g.Repo.AlternarFuncionarioAusente(ctx, id, ausente, strPtr(obs))
}
