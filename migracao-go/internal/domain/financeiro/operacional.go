package financeiro

import (
	"context"
	"time"
)

type Faturamento struct {
	ID, Numero, ClienteNome, Descricao, TipoOperacao string
	ClienteID                                        *string
	Emissao, Vencimento                              time.Time
	ValorBruto, Desconto, Acrescimo, ValorLiquido    Centavos
	ModeloFiscal, EmissorFiscal, Status              string
	TituloID, Observacao                             *string
	ChaveIdempotencia, CriadoPorID, CriadoPorNome    string
	CriadoEm, AtualizadoEm                           time.Time
}

type DocumentoFiscal struct {
	ID, Direcao, Modelo, Emissor, Ambiente, Status, ContraparteNome string
	FaturamentoID, TituloID, Numero, Serie, Chave, Protocolo        *string
	Emissao                                                         time.Time
	Valor                                                           Centavos
	XMLConteudo, UltimoErro                                         *string
	Tentativas                                                      int
	AutorizadoEm, CanceladoEm                                       *time.Time
	CriadoEm, AtualizadoEm                                          time.Time
}

type ContaFinanceira struct {
	ID, Nome, Tipo, Moeda string
	Ativo                 bool
}

type IntegracaoFiscal struct {
	Provedor, Rotulo, Ambiente string
	Ativo                      bool
}

type Fechamento struct {
	Competencia, Status, FechadoEm, FechadoPor, ReabertoEm, ReabertoPor, Justificativa string
}

type ResumoOperacional struct {
	PagarAberto, PagarVencido, ReceberAberto, ReceberVencido Centavos
	FaturadoMes                                              Centavos
	DocumentosPendentes, DocumentosRejeitados                int
}

type OperacaoRepositorio interface {
	Resumo(context.Context, time.Time) (ResumoOperacional, error)
	ListarTitulos(context.Context, TipoTitulo) ([]Titulo, error)
	ListarContas(context.Context) ([]ContaFinanceira, error)
	CriarConta(context.Context, *ContaFinanceira) error
	CriarTituloManual(context.Context, *Titulo, time.Time, string, string) error
	AprovarTitulo(context.Context, string, string, string) error
	ListarFaturamentos(context.Context) ([]Faturamento, error)
	BuscarFaturamento(context.Context, string) (*Faturamento, error)
	CriarFaturamento(context.Context, *Faturamento) error
	FinalizarFaturamento(context.Context, string, string, string) error
	ListarDocumentosFiscais(context.Context) ([]DocumentoFiscal, error)
	ImportarDocumentoLegado(context.Context, *Faturamento, *DocumentoFiscal) error
	RegistrarResultadoFiscal(context.Context, string, string, string, string, string, string, string, string) error
	ListarIntegracoesFiscais(context.Context) ([]IntegracaoFiscal, error)
}
