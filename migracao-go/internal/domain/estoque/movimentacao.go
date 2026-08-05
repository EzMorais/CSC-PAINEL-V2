package estoque

import "time"

type TipoMovimentacao string

const (
	MovEntrada        TipoMovimentacao = "ENTRADA"
	MovSaida          TipoMovimentacao = "SAIDA"
	MovDevolucao      TipoMovimentacao = "DEVOLUCAO"
	MovPerda          TipoMovimentacao = "PERDA"
	MovAjustePositivo TipoMovimentacao = "AJUSTE_POSITIVO"
	MovAjusteNegativo TipoMovimentacao = "AJUSTE_NEGATIVO"
)

var RotuloMovimentacao = map[TipoMovimentacao]string{
	MovEntrada:        "Entrada (compra)",
	MovSaida:          "Saída para obra",
	MovDevolucao:      "Devolução de obra",
	MovPerda:          "Perda ou quebra",
	MovAjustePositivo: "Ajuste de inventário (sobra)",
	MovAjusteNegativo: "Ajuste de inventário (falta)",
}

var TomMovimentacao = map[TipoMovimentacao]string{
	MovEntrada:        "ativa",
	MovDevolucao:      "ativa",
	MovAjustePositivo: "devolvida",
	MovSaida:          "atencao",
	MovPerda:          "vencida",
	MovAjusteNegativo: "devolvida",
}

// SinalMovimentacao: +1 soma no saldo, -1 subtrai. É esta tabela que define o saldo — mudá-la
// reescreve a história. A quantidade gravada é SEMPRE positiva; quem decide o sinal é o tipo.
var SinalMovimentacao = map[TipoMovimentacao]int{
	MovEntrada:        1,
	MovDevolucao:      1,
	MovAjustePositivo: 1,
	MovSaida:          -1,
	MovPerda:          -1,
	MovAjusteNegativo: -1,
}

// ExigeObra: movimentações que exigem informar a obra de destino.
var ExigeObra = map[TipoMovimentacao]bool{MovSaida: true, MovDevolucao: true}

// ExigeFornecedor: só a entrada tem preço/fornecedor — o material já foi pago quando entrou.
var ExigeFornecedor = map[TipoMovimentacao]bool{MovEntrada: true}

// ExigeFuncionario: EPI sai para uma PESSOA, não uma obra — a NR-6 obriga provar a quem foi
// entregue cada equipamento. Só neste caso a saída pede funcionário em vez de obra.
func ExigeFuncionario(tipo TipoMovimentacao, categoria Categoria) bool {
	return tipo == MovSaida && categoria == CategoriaEPI
}

// Movimentacao é o livro-razão append-only: uma lançada errado se corrige com uma nova no
// sentido contrário, nunca editando/apagando a antiga (senão o saldo de ontem mudaria
// retroativamente). Quantidade é sempre positiva.
type Movimentacao struct {
	ID            string
	Tipo          TipoMovimentacao
	Quantidade    float64
	ValorUnitario *float64
	Documento     *string
	Observacao    *string
	OcorridoEm    time.Time
	RegistradoEm  time.Time
	RegistradoPor *string

	// FuncionarioID é o id no banco do RH — bancos hoje separados, sem FK possível.
	FuncionarioID   *string
	FuncionarioNome *string

	SincronizadoEm    *time.Time
	ErroSincronizacao *string

	MaterialID   string
	ObraID       *string
	FornecedorID *string

	// Preenchidos quando a consulta faz join — não são colunas da tabela.
	MaterialCodigo  string
	MaterialNome    string
	MaterialUnidade string
	ObraCodigo      *string
	FornecedorNome  *string
}
