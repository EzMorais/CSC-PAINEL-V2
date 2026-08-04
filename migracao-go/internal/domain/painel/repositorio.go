package painel

import (
	"context"
	"errors"
	"time"
)

var (
	ErrCodigoObraDuplicado = errors.New("já existe uma obra com este código")
	ErrFornecedorDuplicado = errors.New("já existe um fornecedor com este nome")
	ErrAliasDeOutro        = errors.New("apelido já pertence a outro fornecedor")
)

type ObraRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Obra, error)
	BuscarPorCodigo(ctx context.Context, codigo string) (*Obra, error)
	// Listar devolve todas as obras, ordenadas por cliente e depois código.
	Listar(ctx context.Context) ([]Obra, error)
	// ListarAtivas devolve só as ativas — usada nos filtros/formulários.
	ListarAtivas(ctx context.Context) ([]Obra, error)
	Criar(ctx context.Context, o *Obra) error
	Atualizar(ctx context.Context, o *Obra) error
	AtualizarAtiva(ctx context.Context, id string, ativa bool) error
	ContarLocacoesEmAberto(ctx context.Context, obraID string) (int, error)
}

type AliasDono struct {
	Alias          string
	FornecedorNome string
}

type FornecedorRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Fornecedor, error)
	BuscarPorNomeNormalizado(ctx context.Context, nomeNormalizado string) (*Fornecedor, error)
	Listar(ctx context.Context) ([]Fornecedor, error)
	ListarAtivos(ctx context.Context) ([]Fornecedor, error)
	// DonosDeAliases devolve, para cada alias em `aliases` que já pertence a um fornecedor
	// diferente de `excetoFornecedorID`, quem é o dono — ver COMPORTAMENTO.md §4.2.
	DonosDeAliases(ctx context.Context, aliases []string, excetoFornecedorID string) ([]AliasDono, error)
	// Criar grava o fornecedor e seus aliases atomicamente, preenchendo f.ID.
	Criar(ctx context.Context, f *Fornecedor) error
	// Atualizar substitui nome/telefone E o conjunto de aliases por completo (delete+recreate).
	Atualizar(ctx context.Context, f *Fornecedor) error
	AtualizarAtivo(ctx context.Context, id string, ativo bool) error
	// MapaPorApelidoOuNome devolve normalizado(nome|alias) -> fornecedorID, para o importador.
	MapaPorApelidoOuNome(ctx context.Context) (map[string]string, error)
}

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
