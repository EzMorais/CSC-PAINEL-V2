package financeiro

import (
	"context"
	"errors"
	"time"
)

type Centavos int64

func (c Centavos) Valido() bool { return c > 0 }

type TipoTitulo string

const (
	TituloPagar   TipoTitulo = "PAGAR"
	TituloReceber TipoTitulo = "RECEBER"
)

type StatusTitulo string

const (
	TituloRascunho  StatusTitulo = "RASCUNHO"
	TituloPendente  StatusTitulo = "PENDENTE_APROVACAO"
	TituloAprovado  StatusTitulo = "APROVADO"
	TituloParcial   StatusTitulo = "PARCIAL"
	TituloLiquidado StatusTitulo = "LIQUIDADO"
	TituloCancelado StatusTitulo = "CANCELADO"
)

type StatusParcela string

const (
	ParcelaAberta    StatusParcela = "ABERTA"
	ParcelaParcial   StatusParcela = "PARCIAL"
	ParcelaLiquidada StatusParcela = "LIQUIDADA"
	ParcelaCancelada StatusParcela = "CANCELADA"
)

var (
	ErrValorInvalido       = errors.New("valor deve ser maior que zero")
	ErrTituloNaoLiquidavel = errors.New("título não está apto para baixa")
	ErrValorExcedeAberto   = errors.New("valor excede o saldo aberto")
	ErrChaveConflitante    = errors.New("chave de idempotência já usada em outra baixa")
	ErrCompetenciaFechada  = errors.New("competência financeira fechada")
	ErrEstornoDuplicado    = errors.New("movimento já possui estorno")
)

type Titulo struct {
	ID, Numero, ContraparteNome, Descricao string
	Tipo                                   TipoTitulo
	Status                                 StatusTitulo
	ValorTotal, ValorAberto                Centavos
	Emissao                                time.Time
	Competencia                            string
	Parcelas                               []Parcela
	Movimentos                             []Movimento
}
type Parcela struct {
	ID, TituloID               string
	Numero                     int
	Vencimento                 time.Time
	ValorOriginal, ValorAberto Centavos
	Status                     StatusParcela
}
type Movimento struct {
	ID, TituloID                                      string
	ParcelaID, ContaID                                *string
	MovimentoOriginalID                               *string
	Tipo                                              string
	Valor                                             Centavos
	OcorridoEm                                        time.Time
	Documento, Observacao                             *string
	ChaveIdempotencia, RegistradoPor, RegistradoPorID string
	CriadoEm                                          time.Time
}

func (t Titulo) PodeLiquidar() bool { return t.Status == TituloAprovado || t.Status == TituloParcial }
func (t Titulo) StatusAposBaixa(valor Centavos) (StatusTitulo, error) {
	if !valor.Valido() {
		return t.Status, ErrValorInvalido
	}
	if !t.PodeLiquidar() {
		return t.Status, ErrTituloNaoLiquidavel
	}
	if valor > t.ValorAberto {
		return t.Status, ErrValorExcedeAberto
	}
	if valor == t.ValorAberto {
		return TituloLiquidado, nil
	}
	return TituloParcial, nil
}

type Repositorio interface {
	BuscarTitulo(context.Context, string) (*Titulo, error)
	// RegistrarBaixa confere idempotência e recalcula o status DENTRO da transação.
	// Isso evita corrida entre duas baixas concorrentes e permite repetir uma confirmação
	// depois que o primeiro processamento já liquidou o título.
	RegistrarBaixa(context.Context, Movimento) (duplicada bool, status StatusTitulo, err error)
}

// FechamentoRepositorio é opcional para manter adaptadores externos compatíveis:
// quando implementado, o caso de uso consulta a competência antes de gravar e o
// SQLite também protege a operação por trigger.
type FechamentoRepositorio interface {
	CompetenciaFechada(context.Context, string) (bool, error)
	FecharCompetencia(context.Context, string, string, string) error
	ReabrirCompetencia(context.Context, string, string, string, string) error
	ListarFechamentos(context.Context) ([]Fechamento, error)
}

type EstornoRepositorio interface {
	EstornarMovimento(context.Context, string, string, string, string, string) (duplicado bool, status StatusTitulo, err error)
}
