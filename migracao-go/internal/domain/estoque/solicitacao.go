package estoque

import "time"

type StatusSolicitacao string

const (
	StatusRascunho  StatusSolicitacao = "RASCUNHO"
	StatusEnviada   StatusSolicitacao = "ENVIADA"
	StatusAtendida  StatusSolicitacao = "ATENDIDA"
	StatusCancelada StatusSolicitacao = "CANCELADA"
)

var RotuloStatusSolicitacao = map[StatusSolicitacao]string{
	StatusRascunho:  "Rascunho",
	StatusEnviada:   "Enviada ao comprador",
	StatusAtendida:  "Atendida",
	StatusCancelada: "Cancelada",
}

var TomStatusSolicitacao = map[StatusSolicitacao]string{
	StatusRascunho:  "devolvida",
	StatusEnviada:   "atencao",
	StatusAtendida:  "ativa",
	StatusCancelada: "vencida",
}

// SolicitacaoCompra nasce do que está abaixo do mínimo, mas não vira entrada sozinha: comprar
// é decisão de gente. A entrada continua sendo lançada quando o material chega de verdade.
type SolicitacaoCompra struct {
	ID            string
	Numero        string
	Status        StatusSolicitacao
	Observacao    *string
	CriadoEm      time.Time
	EnviadaEm     *time.Time
	AtendidaEm    *time.Time
	RegistradoPor *string

	EmailEnviadoPara *string
	EmailEnviadoEm   *time.Time
	EmailErro        *string

	Itens []ItemSolicitacao
}

// ItemSolicitacao fotografa saldo/mínimo no momento do pedido — não são relações vivas: seis
// meses depois, quem lê o pedido precisa entender por que aquela quantidade foi pedida.
type ItemSolicitacao struct {
	ID            string
	Quantidade    float64
	SaldoNaEpoca  float64
	MinimoNaEpoca float64
	PrecoEstimado *float64
	Observacao    *string

	SolicitacaoID string
	MaterialID    string

	// Preenchidos em join.
	MaterialCodigo  string
	MaterialNome    string
	MaterialUnidade string
}
