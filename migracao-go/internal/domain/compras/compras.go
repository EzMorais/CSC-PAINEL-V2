package compras

import (
	"context"
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
)

type StatusPedidoCompra string

const (
	StatusPedidoRascunho  StatusPedidoCompra = "RASCUNHO"
	StatusPedidoPendente  StatusPedidoCompra = "PENDENTE_APROVACAO"
	StatusPedidoAprovado  StatusPedidoCompra = "APROVADO"
	StatusPedidoEnviado   StatusPedidoCompra = "ENVIADO"
	StatusPedidoRejeitado StatusPedidoCompra = "REJEITADO"
	// ABERTO é mantido apenas para leitura de bancos anteriores à migration 0008.
	StatusPedidoAberto    StatusPedidoCompra = "ABERTO"
	StatusPedidoParcial   StatusPedidoCompra = "PARCIAL"
	StatusPedidoRecebido  StatusPedidoCompra = "RECEBIDO"
	StatusPedidoCancelado StatusPedidoCompra = "CANCELADO"
)

var RotuloStatusPedidoCompra = map[StatusPedidoCompra]string{
	StatusPedidoRascunho:  "Rascunho",
	StatusPedidoPendente:  "Aguardando aprovação",
	StatusPedidoAprovado:  "Aprovado",
	StatusPedidoEnviado:   "Enviado ao fornecedor",
	StatusPedidoRejeitado: "Rejeitado",
	StatusPedidoAberto:    "Aberto",
	StatusPedidoParcial:   "Recebimento parcial",
	StatusPedidoRecebido:  "Recebido",
	StatusPedidoCancelado: "Cancelado",
}

type PedidoCompra struct {
	ID                                          string
	Numero                                      string
	Status                                      StatusPedidoCompra
	SolicitacaoID                               *string
	FornecedorID                                string
	FornecedorNome                              string
	Observacao                                  *string
	CriadoEm                                    time.Time
	RecebidoEm                                  *time.Time
	TotalEstimado                               float64
	TotalRecebido                               float64
	SolicitanteID, SolicitanteNome              string
	AprovadorID, AprovadorNome                  *string
	AprovadoEm, EnviadoEm, PrevisaoEntrega      *time.Time
	CondicaoPagamento, CotacaoID, MotivoEscolha *string
	CanceladoEm                                 *time.Time
	CanceladoPor, MotivoCancelamento            *string
	Itens                                       []ItemPedidoCompra
}

type ItemPedidoCompra struct {
	ID                   string
	PedidoID             string
	MaterialID           string
	MaterialCodigo       string
	MaterialNome         string
	MaterialUnidade      string
	QuantidadeSolicitada float64
	QuantidadeRecebida   float64
	PrecoUnitario        *float64
	Observacao           *string
}

type RecebimentoCompra struct {
	ID                                                           string
	PedidoID                                                     string
	Numero                                                       string
	RecebidoEm                                                   time.Time
	RecebidoPor                                                  string
	NotaFiscal                                                   *string
	Observacao                                                   *string
	ContaPagarID                                                 *string
	ChaveIdempotencia, DataEmissaoNF, ChaveNF, StatusConferencia *string
	ValorNFCentavos                                              *int64
	Itens                                                        []ItemRecebimentoCompra
}

type ItemRecebimentoCompra struct {
	ID                      string
	RecebimentoID           string
	PedidoItemID            string
	MaterialID              string
	Quantidade              float64
	ValorUnitario           float64
	QuantidadeNF            *float64
	ValorNFUnitarioCentavos *int64
}

type ContaPagar struct {
	ID             string
	Numero         string
	PedidoID       *string
	RecebimentoID  *string
	FornecedorID   string
	FornecedorNome string
	ValorTotal     float64
	ValorAberto    float64
	Vencimento     time.Time
	Status         string
	CriadoEm       time.Time
	PagoEm         *time.Time
	Observacao     *string
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
	BuscarPorID(ctx context.Context, id string) (*RecebimentoCompra, error)
	BuscarPorChave(ctx context.Context, chave string) (*RecebimentoCompra, error)
	Listar(ctx context.Context) ([]RecebimentoCompra, error)
	UltimoNumero(ctx context.Context, prefixo string) (string, error)
	Criar(ctx context.Context, r *RecebimentoCompra) error
	AtualizarContaPagar(ctx context.Context, recebimentoID, contaPagarID string) error
	AtualizarConferencia(ctx context.Context, recebimentoID, status string) error
}

type ContaPagarRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*ContaPagar, error)
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

type StatusCotacao string

const (
	CotacaoAberta      StatusCotacao = "ABERTA"
	CotacaoAnalise     StatusCotacao = "EM_ANALISE"
	CotacaoSelecionada StatusCotacao = "SELECIONADA"
	CotacaoCancelada   StatusCotacao = "CANCELADA"
)

type Cotacao struct {
	ID, Numero, SolicitacaoID, SolicitanteID, SolicitanteNome string
	Status                                                    StatusCotacao
	PrazoResposta                                             *time.Time
	Observacao                                                *string
	CriadoEm                                                  time.Time
	EncerradoEm                                               *time.Time
	Fornecedores                                              []FornecedorCotacao
	Propostas                                                 []Proposta
}
type FornecedorCotacao struct {
	FornecedorID, FornecedorNome string
	ConvidadoEm                  time.Time
	RespondeuEm                  *time.Time
}
type Proposta struct {
	ID, CotacaoID, FornecedorID, FornecedorNome      string
	ValorItensCentavos, FreteCentavos, TotalCentavos int64
	PrazoDias                                        *int
	PrevisaoEntrega                                  *time.Time
	CondicaoPagamento, Validade, Observacao, Anexo   *string
	Selecionada                                      bool
	RegistradoPor                                    string
	CriadoEm                                         time.Time
	Itens                                            []ItemProposta
}
type ItemProposta struct {
	ID, PropostaID, MaterialID string
	Quantidade                 float64
	ValorUnitarioCentavos      int64
	Marca, Observacao          *string
}
type Documento struct {
	ID                                  string
	PedidoID, CotacaoID                 *string
	Tipo, Nome, Conteudo, RegistradoPor string
	CriadoEm                            time.Time
}
type Divergencia struct {
	ID, RecebimentoID, Tipo, Esperado, Encontrado, Status string
	PedidoItemID, ResolvidoPor, Justificativa             *string
	CriadoEm                                              time.Time
	ResolvidoEm                                           *time.Time
}
type Devolucao struct {
	ID, Numero, RecebimentoID, FornecedorID, Motivo, Status, RegistradoPor string
	CriadoEm                                                               time.Time
	ConcluidoEm                                                            *time.Time
	Itens                                                                  []ItemDevolucao
}
type ItemDevolucao struct {
	MaterialID            string
	Quantidade            float64
	ValorUnitarioCentavos int64
}
type Contrato struct {
	ID, Numero, FornecedorID, FornecedorNome, Objeto, Periodicidade, CriadoPor string
	Inicio                                                                     time.Time
	Fim                                                                        *time.Time
	ValorLimiteCentavos                                                        *int64
	ValorConsumidoCentavos                                                     int64
	ProximaGeracao                                                             *time.Time
	CondicaoPagamento, Observacao                                              *string
	Ativo                                                                      bool
	CriadoEm                                                                   time.Time
}
type AvaliacaoFornecedor struct {
	ID, FornecedorID              string
	PedidoID                      *string
	Prazo, Qualidade, Atendimento int
	Observacao                    *string
	AvaliadoPor                   string
	CriadoEm                      time.Time
}
type IndicadoresCompras struct {
	PedidosPendentes, PedidosAtrasados, CotacoesAbertas, DivergenciasPendentes int
	TotalCompradoCentavos, EconomiaCotacoesCentavos                            int64
	LeadTimeMedioDias                                                          float64
}
type DesempenhoFornecedor struct {
	FornecedorID, FornecedorNome                 string
	QuantidadeAvaliacoes, QuantidadePedidos      int
	MediaPrazo, MediaQualidade, MediaAtendimento float64
	TotalCompradoCentavos                        int64
}

type ProcessoRepositorio interface {
	UltimoNumeroCotacao(context.Context, string) (string, error)
	CriarCotacao(context.Context, *Cotacao, []string) error
	BuscarCotacao(context.Context, string) (*Cotacao, error)
	ListarCotacoes(context.Context) ([]Cotacao, error)
	RegistrarProposta(context.Context, *Proposta) error
	SelecionarProposta(context.Context, string, string, string, string, string) error
	AtualizarFluxoPedido(context.Context, string, StatusPedidoCompra, StatusPedidoCompra, string, string, string) error
	AtualizarDadosPedido(context.Context, *PedidoCompra) error
	RegistrarDocumento(context.Context, *Documento) error
	ListarDocumentos(context.Context, string, string) ([]Documento, error)
	RegistrarDivergencias(context.Context, []Divergencia) error
	ListarDivergencias(context.Context, string) ([]Divergencia, error)
	ResolverDivergencia(context.Context, string, string, string, string) error
	UltimoNumeroDevolucao(context.Context, string) (string, error)
	CriarDevolucao(context.Context, *Devolucao) error
	ListarDevolucoes(context.Context) ([]Devolucao, error)
	CriarContrato(context.Context, *Contrato) error
	ListarContratos(context.Context) ([]Contrato, error)
	AvaliarFornecedor(context.Context, *AvaliacaoFornecedor) error
	Indicadores(context.Context) (IndicadoresCompras, error)
	ListarDesempenhoFornecedores(context.Context) ([]DesempenhoFornecedor, error)
}

type TituloFinanceiroCompra struct {
	ChaveOrigem, Numero, FornecedorID, FornecedorNome, Descricao string
	ValorCentavos                                                int64
	Emissao, Vencimento                                          time.Time
	NotaFiscal, ChaveNF                                          *string
	EmissaoFiscal                                                *time.Time
	ValorFiscalCentavos                                          *int64
}
type AbatimentoDevolucao struct {
	RecebimentoID, DevolucaoID, DevolucaoNumero, Motivo, RegistradoPor string
	ValorCentavos                                                      int64
	OcorridoEm                                                         time.Time
}
type ClienteFinanceiro interface {
	CriarTituloCompra(context.Context, TituloFinanceiroCompra) error
	// AbaterDevolucao reduz o saldo aberto do título já materializado pelo
	// recebimento na mesma proporção da devolução. Sem título materializado é
	// no-op; ídempotente por devolução (nunca reduz o mesmo título duas vezes).
	AbaterDevolucao(context.Context, AbatimentoDevolucao) error
}
