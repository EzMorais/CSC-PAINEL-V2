package painel

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

type Indicadores struct {
	ValorEmLocacao   float64
	Ativos           int
	VencemEm7Dias    int
	Vencidos         int
	Perdidos         int
	PerdidosEmAberto int
	AConfirmar       int
}

// ObterIndicadores espelha `obterIndicadores` — ver COMPORTAMENTO.md §5.2.
func ObterIndicadores(ctx context.Context, repo dominio.LocacaoRepositorio, hoje time.Time) (*Indicadores, error) {
	linhas, err := repo.ValorItemDatasNaoDevolvidas(ctx)
	if err != nil {
		return nil, err
	}
	var valorTotal float64
	for _, l := range linhas {
		valorTotal += dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim)
	}

	ativos, err := repo.ContarNaoDevolvidas(ctx)
	if err != nil {
		return nil, err
	}
	limite7 := dominio.LimiteEmDias(dominio.DiasAtencao, hoje)
	vencemEm7, err := repo.ContarVencemEmDias(ctx, limite7, hoje)
	if err != nil {
		return nil, err
	}
	vencidos, err := repo.ContarVencidas(ctx, hoje)
	if err != nil {
		return nil, err
	}
	perdidos, err := repo.ContarPorEstado(ctx, dominio.EstadoPerdido, false)
	if err != nil {
		return nil, err
	}
	perdidosEmAberto, err := repo.ContarPorEstado(ctx, dominio.EstadoPerdido, true)
	if err != nil {
		return nil, err
	}
	aConfirmar, err := repo.ContarAConfirmar(ctx)
	if err != nil {
		return nil, err
	}

	return &Indicadores{
		ValorEmLocacao: valorTotal, Ativos: ativos, VencemEm7Dias: vencemEm7,
		Vencidos: vencidos, Perdidos: perdidos, PerdidosEmAberto: perdidosEmAberto,
		AConfirmar: aConfirmar,
	}, nil
}
