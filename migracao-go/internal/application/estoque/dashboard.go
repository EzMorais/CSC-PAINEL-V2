package estoque

import (
	"context"
	"sort"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
)

type GerenciadorDashboard struct {
	Materiais     dominio.MaterialRepositorio
	Movimentacoes dominio.MovimentacaoRepositorio
}

type Indicadores struct {
	TotalMateriais, SemEstoque, AbaixoDoMinimo int
	ValorEmEstoque                             float64
	EntradasDoMes, SaidasDoMes                 int
	ObrasAtivas                                int
}

func inicioDoMes() string {
	agora := time.Now().UTC()
	return time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
}

// Indicadores espelha `indicadores()` de queries/dashboard.ts. ObrasAtivas é passado pelo
// chamador (handler) já contado — este pacote não depende do repositório de Obra pra não
// criar acoplamento circular entre estoque e cadastro.
func (g *GerenciadorDashboard) Indicadores(ctx context.Context, obrasAtivas int) (*Indicadores, error) {
	materiais, err := (&GerenciadorMateriais{Materiais: g.Materiais}).ListarComSaldo(ctx, dominio.FiltrosMaterial{})
	if err != nil {
		return nil, err
	}

	ind := &Indicadores{ObrasAtivas: obrasAtivas}
	for _, m := range materiais {
		if !m.Ativo {
			continue
		}
		ind.TotalMateriais++
		switch m.Situacao {
		case dominio.SituacaoZerado:
			ind.SemEstoque++
		case dominio.SituacaoAbaixo:
			ind.AbaixoDoMinimo++
		}
		// Só saldo positivo entra: negativo é erro de lançamento, não deve "encolher" o total.
		if m.ValorEmEstoque != nil && *m.ValorEmEstoque > 0 {
			ind.ValorEmEstoque += *m.ValorEmEstoque
		}
	}

	desde := inicioDoMes()
	entradas, err := g.Movimentacoes.ContarPorTipoDesde(ctx, dominio.MovEntrada, desde)
	if err != nil {
		return nil, err
	}
	saidas, err := g.Movimentacoes.ContarPorTipoDesde(ctx, dominio.MovSaida, desde)
	if err != nil {
		return nil, err
	}
	ind.EntradasDoMes, ind.SaidasDoMes = entradas, saidas
	return ind, nil
}

// MateriaisParaRepor: sem estoque antes de abaixo do mínimo, e dentro de cada grupo o mais
// crítico primeiro. Ver COMPORTAMENTO.md §8.
func (g *GerenciadorDashboard) MateriaisParaRepor(ctx context.Context, limite int) ([]dominio.MaterialComSaldo, error) {
	materiais, err := (&GerenciadorMateriais{Materiais: g.Materiais}).ListarComSaldo(ctx, dominio.FiltrosMaterial{})
	if err != nil {
		return nil, err
	}
	var criticos []dominio.MaterialComSaldo
	for _, m := range materiais {
		if m.Ativo && m.Situacao != dominio.SituacaoOK {
			criticos = append(criticos, m)
		}
	}
	sort.Slice(criticos, func(i, j int) bool {
		if criticos[i].Situacao != criticos[j].Situacao {
			return criticos[i].Situacao == dominio.SituacaoZerado
		}
		return criticos[i].Saldo < criticos[j].Saldo
	})
	if len(criticos) > limite {
		criticos = criticos[:limite]
	}
	return criticos, nil
}

func (g *GerenciadorDashboard) MovimentacoesRecentes(ctx context.Context, limite int) ([]dominio.Movimentacao, error) {
	return g.Movimentacoes.Recentes(ctx, limite)
}

type ConsumoObra struct {
	ObraID string
	Itens  float64
	Valor  float64
}

// ConsumoPorObra: saídas menos devoluções, valorizado pelo último preço — sinal invertido
// em relação ao saldo (a pergunta aqui é "quanto a obra levou"). Ver COMPORTAMENTO.md §8.
func (g *GerenciadorDashboard) ConsumoPorObra(ctx context.Context) (map[string]ConsumoObra, error) {
	linhas, err := g.Movimentacoes.ConsumoPorObra(ctx)
	if err != nil {
		return nil, err
	}
	precos, err := g.Materiais.UltimoPrecoPorMaterial(ctx)
	if err != nil {
		return nil, err
	}
	resultado := map[string]ConsumoObra{}
	for _, l := range linhas {
		sinal := float64(dominio.SinalMovimentacao[l.Tipo])
		c := resultado[l.ObraID]
		c.ObraID = l.ObraID
		c.Itens += -sinal * l.Quantidade
		c.Valor += -sinal * l.Quantidade * precos[l.MaterialID]
		resultado[l.ObraID] = c
	}
	return resultado, nil
}

func (g *GerenciadorDashboard) ListarFichasPendentes(ctx context.Context) ([]dominio.Movimentacao, error) {
	return g.Movimentacoes.ListarFichasPendentes(ctx)
}
