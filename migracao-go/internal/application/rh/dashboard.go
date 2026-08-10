package rh

import (
	"context"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type GerenciadorDashboard struct {
	Funcionarios dominio.FuncionarioRepositorio
	Eventos      dominio.EventoRepositorio
}

// Indicadores — COMPORTAMENTO.md §8. ObrasAtivas é passado pelo handler já contado, mesma
// decisão de application/estoque/dashboard.go (evita este pacote importar o pacote cadastro).
type Indicadores struct {
	Ativos, Afastados, Ferias, Desligados int
	CadastrosIncompletos                  int
	ObrasAtivas                           int
}

func (g *GerenciadorDashboard) Carregar(ctx context.Context, obrasAtivas int) (*Indicadores, error) {
	porStatus, err := g.Funcionarios.ContarPorStatus(ctx)
	if err != nil {
		return nil, err
	}
	incompletos, err := g.Funcionarios.ContarCadastrosIncompletos(ctx)
	if err != nil {
		return nil, err
	}
	return &Indicadores{
		Ativos: porStatus[dominio.StatusAtivo], Afastados: porStatus[dominio.StatusAfastado],
		Ferias: porStatus[dominio.StatusFerias], Desligados: porStatus[dominio.StatusDesligado],
		CadastrosIncompletos: incompletos, ObrasAtivas: obrasAtivas,
	}, nil
}

func (g *GerenciadorDashboard) EventosRecentes(ctx context.Context, limite int) ([]dominio.Evento, error) {
	return g.Eventos.ListarRecentes(ctx, limite)
}
