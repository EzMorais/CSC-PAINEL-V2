package estoque

import "time"

type TipoAprovacao string

const (
	AprovacaoAjusteInventario  TipoAprovacao = "AJUSTE_INVENTARIO"
	AprovacaoPerda             TipoAprovacao = "PERDA"
	AprovacaoSolicitacaoCompra TipoAprovacao = "SOLICITACAO_COMPRA"
)

var RotuloTipoAprovacao = map[TipoAprovacao]string{
	AprovacaoAjusteInventario:  "Ajuste de inventário",
	AprovacaoPerda:             "Perda ou quebra",
	AprovacaoSolicitacaoCompra: "Solicitação de compra",
}

// MotivoDaRegra explica por que cada tipo precisa de autorização — aparece na tela de quem aprova.
var MotivoDaRegra = map[TipoAprovacao]string{
	AprovacaoAjusteInventario: "Ajuste some com estoque sem contrapartida: é a forma mais " +
		"silenciosa de um furo virar número certo no sistema.",
	AprovacaoPerda: "Baixa por perda tira material do saldo sem nada entrando em troca — " +
		"merece um segundo par de olhos.",
	AprovacaoSolicitacaoCompra: "Acima do limite configurado, o pedido compromete dinheiro e " +
		"vai direto ao fornecedor.",
}

type StatusAprovacao string

const (
	AprovacaoPendente  StatusAprovacao = "PENDENTE"
	AprovacaoAprovada  StatusAprovacao = "APROVADA"
	AprovacaoRejeitada StatusAprovacao = "REJEITADA"
)

var RotuloStatusAprovacao = map[StatusAprovacao]string{
	AprovacaoPendente:  "Aguardando aprovação",
	AprovacaoAprovada:  "Aprovada",
	AprovacaoRejeitada: "Recusada",
}

var TomStatusAprovacao = map[StatusAprovacao]string{
	AprovacaoPendente:  "atencao",
	AprovacaoAprovada:  "ativa",
	AprovacaoRejeitada: "vencida",
}

// PrecisaAprovacao: quem já pode aprovar não passa pela fila — não é brecha, é o que evita
// travar o trabalho esperando um segundo gerente aparecer.
func PrecisaAprovacao(podeAprovar bool, excedeLimite bool) bool {
	return excedeLimite && !podeAprovar
}

// Aprovacao é o pedido de autorização — guarda o que SERIA feito, não o que foi feito. A
// execução acontece só quando aprovada (ver application/estoque/aprovacoes.go).
type Aprovacao struct {
	ID     string
	Tipo   TipoAprovacao
	Status StatusAprovacao
	Dados  string // JSON — formato depende de Tipo, ver DadosAjusteInventario/DadosPerda/DadosSolicitacaoCompra.
	Motivo *string
	Resumo string

	SolicitanteID   string
	SolicitanteNome string
	AprovadorID     *string
	AprovadorNome   *string
	MotivoRejeicao  *string

	ReferenciaID *string

	CriadoEm   time.Time
	DecididoEm *time.Time
}

type DadosAjusteInventario struct {
	MaterialID        string  `json:"materialId"`
	QuantidadeContada float64 `json:"quantidadeContada"`
	Observacao        *string `json:"observacao,omitempty"`
}

type DadosPerda struct {
	MaterialID string  `json:"materialId"`
	Quantidade float64 `json:"quantidade"`
	OcorridoEm string  `json:"ocorridoEm"`
	Documento  *string `json:"documento,omitempty"`
	Observacao *string `json:"observacao,omitempty"`
}

type DadosSolicitacaoCompra struct {
	SolicitacaoID string `json:"solicitacaoId"`
}
