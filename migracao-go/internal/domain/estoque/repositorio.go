package estoque

import (
	"context"
	"errors"
)

var ErrCodigoMaterialDuplicado = errors.New("já existe um material com este código")

type FiltrosMaterial struct {
	Busca     string
	Categoria string
	Situacao  string
}

type MaterialComSaldo struct {
	Material
	Saldo          float64
	Situacao       SituacaoSaldo
	UltimoPreco    *float64
	ValorEmEstoque *float64
}

type MaterialRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Material, error)
	// Listar aplica busca/categoria no SQL; situação é derivada e filtrada em memória (ver
	// COMPORTAMENTO.md §8) — por isso não entra nos FiltrosMaterial deste método.
	Listar(ctx context.Context, filtros FiltrosMaterial) ([]Material, error)
	Criar(ctx context.Context, m *Material) error
	Atualizar(ctx context.Context, m *Material) error
	AtualizarAtivo(ctx context.Context, id string, ativo bool) error
	UltimoCodigo(ctx context.Context) (string, error)

	// SaldoPorMaterial soma TODAS as movimentações agrupadas por material+tipo numa query só
	// (nunca N+1) — ver COMPORTAMENTO.md §3.
	SaldoPorMaterial(ctx context.Context) (map[string]float64, error)
	SaldoDoMaterial(ctx context.Context, materialID string) (float64, error)
	// UltimoPrecoPorMaterial: valorUnitario da ENTRADA mais recente de cada material.
	UltimoPrecoPorMaterial(ctx context.Context) (map[string]float64, error)
}

type FiltrosMovimentacao struct {
	Busca      string
	Tipo       string
	ObraID     string
	MaterialID string
}

type MovimentacaoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Movimentacao, error)
	Listar(ctx context.Context, filtros FiltrosMovimentacao, limite int) ([]Movimentacao, error)
	Criar(ctx context.Context, m *Movimentacao) error
	MarcarSincronizada(ctx context.Context, id string, erro *string) error
	// ListarFichasPendentes: saídas de EPI com funcionarioId preenchido e ainda não sincronizadas.
	ListarFichasPendentes(ctx context.Context) ([]Movimentacao, error)
	// Recentes e agregações do dashboard.
	Recentes(ctx context.Context, limite int) ([]Movimentacao, error)
	ContarPorTipoDesde(ctx context.Context, tipo TipoMovimentacao, desde string) (int, error)
	ConsumoPorObra(ctx context.Context) ([]LinhaConsumoObra, error)
}

type LinhaConsumoObra struct {
	Tipo       TipoMovimentacao
	Quantidade float64
	MaterialID string
	ObraID     string
}

type SolicitacaoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*SolicitacaoCompra, error)
	Listar(ctx context.Context) ([]SolicitacaoCompra, error)
	UltimoNumeroDoAno(ctx context.Context, prefixo string) (string, error)
	Criar(ctx context.Context, s *SolicitacaoCompra) error
	AtualizarStatus(ctx context.Context, id string, status StatusSolicitacao, enviadaEm, atendidaEm *string) error
	AtualizarEnvioEmail(ctx context.Context, id string, enviadoPara *string, enviadoEm *string, erro *string, status *StatusSolicitacao) error
	Excluir(ctx context.Context, id string) error
	ContarAbertas(ctx context.Context) (int, error)
}

type AprovacaoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Aprovacao, error)
	Listar(ctx context.Context, status string) ([]Aprovacao, error)
	ContarPendentes(ctx context.Context) (int, error)
	Criar(ctx context.Context, a *Aprovacao) error
	Decidir(ctx context.Context, id string, status StatusAprovacao, aprovadorID, aprovadorNome string, motivoRejeicao, referenciaID *string) error
}

type ConfiguracaoEmailRepositorio interface {
	Obter(ctx context.Context) (*ConfiguracaoEmail, error)
	Salvar(ctx context.Context, c *ConfiguracaoEmail) error
	MarcarTestada(ctx context.Context) error
	AtualizarAtivo(ctx context.Context, ativo bool) error
}

// FichaEpi e ResultadoRH descrevem a porta de saída pro módulo de RH — ver
// COMPORTAMENTO.md §6. ClienteRH é implementada por internal/infrastructure/clienterh; o
// domínio não sabe que a chamada é HTTP.
type FichaEpi struct {
	MovimentacaoID string  `json:"movimentacaoId"`
	FuncionarioID  string  `json:"funcionarioId"`
	MaterialCodigo string  `json:"materialCodigo"`
	MaterialNome   string  `json:"materialNome"`
	Unidade        string  `json:"unidade"`
	Quantidade     float64 `json:"quantidade"`
	CA             *string `json:"ca"`
	ValidadeCA     *string `json:"validadeCA"`
	EntregueEm     string  `json:"entregueEm"`
	EntreguePor    *string `json:"entreguePor"`
	Observacao     *string `json:"observacao"`
}

type ResultadoRH struct {
	OK         bool
	Erro       string
	Permanente bool
}

type ClienteRH interface {
	EnviarFichaEpi(ctx context.Context, ficha FichaEpi) ResultadoRH
}

// EmailRemetente é a porta de saída de e-mail — ver COMPORTAMENTO.md §7. Implementada por
// internal/infrastructure/emailenvio.
type EmailConfig struct {
	Host      string
	Porta     int
	Usuario   string
	Senha     string
	Remetente string
}

type EmailMensagem struct {
	Para      string
	Assunto   string
	Corpo     string
	CopiaPara string
}

type EmailRemetente interface {
	Enviar(cfg EmailConfig, msg EmailMensagem) error
	TestarConexao(cfg EmailConfig) error
	TraduzirErro(err error) string
}
