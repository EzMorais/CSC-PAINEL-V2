package painel

import (
	"context"
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
)

// ObraRepositorio, FornecedorRepositorio, AliasDono e os erros sentinela de Obra/Fornecedor
// moraram aqui originalmente; agora vivem em internal/domain/cadastro (compartilhados com o
// Almoxarifado). Aliases mantidos para não obrigar o resto do pacote painel a trocar de nome.
type ObraRepositorio = cadastro.ObraRepositorio
type FornecedorRepositorio = cadastro.FornecedorRepositorio
type AliasDono = cadastro.AliasDono

var (
	ErrCodigoObraDuplicado = cadastro.ErrCodigoObraDuplicado
	ErrFornecedorDuplicado = cadastro.ErrFornecedorDuplicado
	ErrAliasDeOutro        = cadastro.ErrAliasDeOutro
)

type FiltrosLocacao struct {
	Busca        string
	ObraID       string
	FornecedorID string
	Status       string // "", ATIVA, ATENCAO, VENCIDA, DEVOLVIDA, SEM_PRAZO, TODAS
	Estado       string
	AConfirmar   bool
}

type LocacaoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Locacao, error)
	Listar(ctx context.Context, filtros FiltrosLocacao, hoje time.Time) ([]Locacao, error)
	Criar(ctx context.Context, l *Locacao, mov Movimentacao) error
	// Atualizar grava os campos de l (todos, o chamador decide o que mudou) e adiciona mov.
	Atualizar(ctx context.Context, l *Locacao, mov Movimentacao) error
	ContarPorObra(ctx context.Context, obraID string, somenteEmAberto bool) (int, error)
	// ReclassificarEmLote muda obraId + zera obraAConfirmar para os ids dados, e grava uma
	// Movimentacao RECLASSIFICACAO por item — tudo numa transação.
	ReclassificarEmLote(ctx context.Context, ids []string, obraDestinoID string, obraDestinoCodigo string) error
	// ChavesExistentes devolve o conjunto de chaves de idempotência já gravadas — ver
	// COMPORTAMENTO.md §6.6. A chave é montada pelo chamador (camada de aplicação).
	ChavesExistentes(ctx context.Context) (map[string]bool, error)
	// CriarLote grava várias locações (usado pela importação), cada uma com sua Movimentacao
	// IMPORTACAO, e devolve quantas foram criadas.
	CriarLote(ctx context.Context, itens []ItemImportacao) (int, error)

	// Indicadores e agregações do dashboard — ver COMPORTAMENTO.md §5.2.
	ValorItemDatasNaoDevolvidas(ctx context.Context) ([]ValorEDatas, error)
	ContarNaoDevolvidas(ctx context.Context) (int, error)
	ContarVencemEmDias(ctx context.Context, ate time.Time, hoje time.Time) (int, error)
	ContarVencidas(ctx context.Context, hoje time.Time) (int, error)
	ContarPorEstado(ctx context.Context, estado Estado, somenteEmAberto bool) (int, error)
	ContarAConfirmar(ctx context.Context) (int, error)
	PorFornecedorNaoDevolvidas(ctx context.Context) ([]LinhaAgregada, error)
	PorObraNaoDevolvidas(ctx context.Context) ([]LinhaAgregada, error)
	VencimentosProximos(ctx context.Context, ate time.Time, limite int) ([]Locacao, error)

	// TodasParaExportar traz obras + locações (ativas e devolvidas) prontas para os
	// exportadores Excel/PDF — ver COMPORTAMENTO.md §7.
	ParaExportarExcel(ctx context.Context) ([]ObraComLocacoes, error)
	ParaExportarPDF(ctx context.Context) ([]ObraComLocacoes, error)
}

type ValorEDatas struct {
	ValorItem  *float64
	DataInicio *time.Time
	DataFim    *time.Time
}

type LinhaAgregada struct {
	Nome       string
	Valor      float64
	Quantidade int
}

type ObraComLocacoes struct {
	Obra
	Locacoes []Locacao
}

// ItemImportacao é uma linha já resolvida (fornecedorID e obraID já mapeados) pronta pra
// gravar — a camada de aplicação decide o mapeamento, o repositório só persiste.
type ItemImportacao struct {
	Locacao
	Aba   string
	Linha int
}
