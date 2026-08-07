package rh

import (
	"context"
	"time"
)

// EntregaEpi — NUNCA criada pelo RH sozinho, só recebida via integração com o Almoxarifado
// (POST /api/integracao/entregas-epi). Idempotente por MovimentacaoID. COMPORTAMENTO.md §6.
type EntregaEpi struct {
	ID             string
	MovimentacaoID string
	MaterialCodigo string
	MaterialNome   string
	CA             *string
	ValidadeCA     *string
	Quantidade     float64
	Unidade        string
	EntregueEm     time.Time
	Observacao     *string
	EntreguePor    *string
	RecebidoEm     time.Time
	FuncionarioID  string
}

type EntregaEpiComNome struct {
	EntregaEpi
	FuncionarioNome string
}

type EntregaEpiRepositorio interface {
	BuscarPorMovimentacaoID(ctx context.Context, movimentacaoID string) (*EntregaEpi, error)
	Criar(ctx context.Context, e *EntregaEpi) error
	Listar(ctx context.Context) ([]EntregaEpiComNome, error)
	ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]EntregaEpi, error)
}
