// Package estoque contém as entidades e regras de negócio do módulo Almoxarifado. Não
// importa banco de dados nem HTTP — ver ARQUITETURA.md §1 e estoque/COMPORTAMENTO.md.
package estoque

import "time"

type Categoria string

const (
	CategoriaCimentoArgamassa  Categoria = "CIMENTO_ARGAMASSA"
	CategoriaAgregado          Categoria = "AGREGADO"
	CategoriaAcoFerragem       Categoria = "ACO_FERRAGEM"
	CategoriaMadeira           Categoria = "MADEIRA"
	CategoriaEletrica          Categoria = "ELETRICA"
	CategoriaHidraulica        Categoria = "HIDRAULICA"
	CategoriaPintura           Categoria = "PINTURA"
	CategoriaImpermeabilizacao Categoria = "IMPERMEABILIZACAO"
	CategoriaEPI               Categoria = "EPI"
	CategoriaFerramenta        Categoria = "FERRAMENTA"
	CategoriaConsumivel        Categoria = "CONSUMIVEL"
	CategoriaOutro             Categoria = "OUTRO"
)

// Categorias lista as 12 categorias válidas, nesta ordem — pro <select> da UI.
var Categorias = []Categoria{
	CategoriaCimentoArgamassa, CategoriaAgregado, CategoriaAcoFerragem, CategoriaMadeira,
	CategoriaEletrica, CategoriaHidraulica, CategoriaPintura, CategoriaImpermeabilizacao,
	CategoriaEPI, CategoriaFerramenta, CategoriaConsumivel, CategoriaOutro,
}

func (c Categoria) Valida() bool {
	for _, v := range Categorias {
		if v == c {
			return true
		}
	}
	return false
}

var RotuloCategoria = map[Categoria]string{
	CategoriaCimentoArgamassa:  "Cimento e argamassa",
	CategoriaAgregado:          "Agregados (areia, brita)",
	CategoriaAcoFerragem:       "Aço e ferragem",
	CategoriaMadeira:           "Madeira e formas",
	CategoriaEletrica:          "Elétrica",
	CategoriaHidraulica:        "Hidráulica",
	CategoriaPintura:           "Pintura",
	CategoriaImpermeabilizacao: "Impermeabilização",
	CategoriaEPI:               "EPI",
	CategoriaFerramenta:        "Ferramentas",
	CategoriaConsumivel:        "Consumíveis",
	CategoriaOutro:             "Outro",
}

// Unidades de medida — a sigla é o que aparece na tela, já é o que o almoxarife usa na nota
// fiscal, traduzir para nome completo só atrapalharia a conferência.
var Unidades = []string{"UN", "CX", "PC", "PAR", "KG", "SC", "M", "M2", "M3", "L", "RL"}

func UnidadeValida(u string) bool {
	for _, v := range Unidades {
		if v == u {
			return true
		}
	}
	return false
}

type SituacaoSaldo string

const (
	SituacaoZerado SituacaoSaldo = "ZERADO"
	SituacaoAbaixo SituacaoSaldo = "ABAIXO"
	SituacaoOK     SituacaoSaldo = "OK"
)

var RotuloSituacaoSaldo = map[SituacaoSaldo]string{
	SituacaoZerado: "Sem estoque",
	SituacaoAbaixo: "Abaixo do mínimo",
	SituacaoOK:     "Normal",
}

var TomSituacaoSaldo = map[SituacaoSaldo]string{
	SituacaoZerado: "vencida",
	SituacaoAbaixo: "atencao",
	SituacaoOK:     "ativa",
}

// SituacaoDoSaldo: mínimo zero significa "não controlo reposição deste item" — só o saldo
// zerado é digno de alerta nesse caso, senão todo item sem mínimo viveria "abaixo do mínimo".
func SituacaoDoSaldo(saldo, estoqueMinimo float64) SituacaoSaldo {
	if saldo <= 0 {
		return SituacaoZerado
	}
	if estoqueMinimo > 0 && saldo < estoqueMinimo {
		return SituacaoAbaixo
	}
	return SituacaoOK
}

// Material é o cadastro do item — não o saldo. Ver movimentacao.go: o saldo é sempre somado
// a partir de Movimentacao, nunca armazenado (evita discordância entre coluna e histórico).
type Material struct {
	ID            string
	Codigo        string
	Nome          string
	Categoria     Categoria
	Unidade       string
	EstoqueMinimo float64
	Localizacao   *string
	Observacao    *string
	Ativo         bool
	// CA e ValidadeCA só fazem sentido em CategoriaEPI — a NR-6 exige o Certificado de
	// Aprovação na ficha de cada entrega; mora aqui pra digitar uma vez, no cadastro.
	CA           *string
	ValidadeCA   *time.Time
	CriadoEm     time.Time
	AtualizadoEm time.Time
}
