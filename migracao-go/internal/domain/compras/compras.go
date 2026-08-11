package compras

import (
	"context"
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
)

type StatusPedidoCompra string

const (
	StatusPedidoAberto    StatusPedidoCompra = "ABERTO"
	StatusPedidoParcial   StatusPedidoCompra = "PARCIAL"
	StatusPedidoRecebido  StatusPedidoCompra = "RECEBIDO"
	StatusPedidoCancelado StatusPedidoCompra = "CANCELADO"
)

var RotuloStatusPedidoCompra = map[StatusPedidoCompra]string{
	StatusPedidoAberto:    "Aberto",
	StatusPedidoParcial:   "Recebimento parcial",
	StatusPedidoRecebido:  "Recebido",
	StatusPedidoCancelado: "Cancelado",
}

type PedidoCompra struct {
	ID            string
	Numero        string
	Status        StatusPedidoCompra
	SolicitacaoID *string
	FornecedorID  string
	FornecedorNome string
	Observacao    *string
	CriadoEm      time.Time
	RecebidoEm    *time.Time
	TotalEstimado float64
	TotalRecebido float64
	Itens         []ItemPedidoCompra
}

type ItemPedidoCompra struct {
	ID                  string
	PedidoID            string
	MaterialID          string
	MaterialCodigo      string
	MaterialNome        string
	MaterialUnidade     string
	QuantidadeSolicitada float64
	QuantidadeRecebida  float64
	PrecoUnitario       *float64
	Observacao          *string
}

type RecebimentoCompra struct {
	ID           string
	PedidoID     string
	Numero       string
	RecebidoEm   time.Time
	RecebidoPor  string
	NotaFiscal   *string
	Observacao   *string
	ContaPagarID *string
	Itens        []ItemRecebimentoCompra
}

type ItemRecebimentoCompra struct {
	ID             string
	RecebimentoID   string
	PedidoItemID    string
	MaterialID      string
	Quantidade      float64
	ValorUnitario   float64
}

type ContaPagar struct {
	ID            string
	Numero        string
	PedidoID      *string
	RecebimentoID  *string
	FornecedorID  string
	FornecedorNome string
	ValorTotal    float64
	ValorAberto   float64
	Vencimento    time.Time
	Status        string
	CriadoEm      time.Time
	PagoEm        *time.Time
	Observacao    *string
}

type ResumoDashboard struct {
	PedidosPendentes []PedidoCompra
	PedidosRecentes  []PedidoCompra
	ContasAbertas    []ContaPagar
	ComprasPendentes []estoque.SolicitacaoCompra
	Fornecedores     []cadastro.Fornecedor
	TotalAberto      float64
}

type PedidoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*PedidoCompra, error)
	Listar(ctx context.Context) ([]PedidoCompra, error)
	UltimoNumero(ctx context.Context, prefixo string) (string, error)
	Criar(ctx context.Context, p *PedidoCompra) error
	AtualizarStatus(ctx context.Context, id string, status StatusPedidoCompra, recebidoEm *string, totalRecebido float64) error
	AtualizarItemRecebido(ctx context.Context, itemID string, quantidadeRecebida float64) error
}

type RecebimentoRepositorio interface {
	UltimoNumero(ctx context.Context, prefixo string) (string, error)
	Criar(ctx context.Context, r *RecebimentoCompra) error
	AtualizarContaPagar(ctx context.Context, recebimentoID, contaPagarID string) error
}

type ContaPagarRepositorio interface {
	UltimoNumero(ctx context.Context, prefixo string) (string, error)
	ListarAbertas(ctx context.Context) ([]ContaPagar, error)
	Criar(ctx context.Context, c *ContaPagar) error
}

type FornecedorRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*cadastro.Fornecedor, error)
	ListarAtivos(ctx context.Context) ([]cadastro.Fornecedor, error)
}

type SolicitacaoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*estoque.SolicitacaoCompra, error)
	Listar(ctx context.Context) ([]estoque.SolicitacaoCompra, error)
}

type MaterialRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*estoque.Material, error)
}

type MovimentacaoRepositorio interface {
	Criar(ctx context.Context, m *estoque.Movimentacao) error
}
