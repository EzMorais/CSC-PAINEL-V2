package estoque

import (
	"context"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
)

type Limites struct{ Compra, Ajuste float64 }

// obterLimites: sem configuração salva, valem os padrões (1000/10) — a regra de aprovação
// tem de existir desde o primeiro dia, senão só passa a valer quando alguém lembrar de
// configurar. Ver COMPORTAMENTO.md §4.
func obterLimites(ctx context.Context, repo dominio.ConfiguracaoEmailRepositorio) (Limites, error) {
	c, err := repo.Obter(ctx)
	if err != nil {
		return Limites{}, err
	}
	if c == nil {
		return Limites{Compra: 1000, Ajuste: 10}, nil
	}
	return Limites{Compra: c.LimiteAprovacaoCompra, Ajuste: c.LimiteAjusteInventario}, nil
}
