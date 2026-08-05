// Package cadastro contém Obra e Fornecedor — entidades compartilhadas entre módulos
// (decisão de banco único em migracao-go/README.md "Banco único"). Nasceram no Painel de
// Locação (migration 0002_painel.sql) e o Almoxarifado passou a referenciá-las por FK, não
// recriar. Não importa banco de dados nem HTTP — ver ARQUITETURA.md §1.
package cadastro

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

type Obra struct {
	ID          string
	Cliente     string
	Codigo      string
	Descricao   string
	Responsavel *string
	// AbaOrigem é usado só pelo importador do Painel — de qual aba da planilha os itens desta
	// obra vêm. Os demais módulos simplesmente não o preenchem.
	AbaOrigem string
	Ativa     bool
	CriadoEm  time.Time
}

type Fornecedor struct {
	ID       string
	Nome     string
	Telefone *string
	// Cnpj e Email só são usados pelo Almoxarifado — o Painel não os preenche (ficam nil).
	Cnpj     *string
	Email    *string
	Ativo    bool
	Aliases  []string
	CriadoEm time.Time
}

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
	// diferente de `excetoFornecedorID`, quem é o dono — ver painel/COMPORTAMENTO.md §4.2.
	DonosDeAliases(ctx context.Context, aliases []string, excetoFornecedorID string) ([]AliasDono, error)
	// Criar grava o fornecedor e seus aliases atomicamente, preenchendo f.ID.
	Criar(ctx context.Context, f *Fornecedor) error
	// Atualizar substitui nome/telefone E o conjunto de aliases por completo (delete+recreate).
	Atualizar(ctx context.Context, f *Fornecedor) error
	AtualizarAtivo(ctx context.Context, id string, ativo bool) error
	// MapaPorApelidoOuNome devolve normalizado(nome|alias) -> fornecedorID, para o importador do Painel.
	MapaPorApelidoOuNome(ctx context.Context) (map[string]string, error)
}
