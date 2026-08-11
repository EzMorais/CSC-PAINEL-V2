// Package identidade contém as entidades e regras de negócio do módulo de identidade
// (o antigo Portal). Não importa banco de dados nem HTTP — ver ARQUITETURA.md §1.
package identidade

import "time"

type Cargo string

const (
	CargoAdmin       Cargo = "ADMIN"
	CargoDiretoria   Cargo = "DIRETORIA"
	CargoGerente     Cargo = "GERENTE"
	CargoOperacional Cargo = "OPERACIONAL"
	CargoConsulta    Cargo = "CONSULTA"
)

// Cargos lista os 5 cargos válidos, nesta ordem — a ordem importa pros <select> da UI.
// Ver COMPORTAMENTO.md §3.
var Cargos = []Cargo{CargoAdmin, CargoDiretoria, CargoGerente, CargoOperacional, CargoConsulta}

func (c Cargo) Valido() bool {
	for _, v := range Cargos {
		if v == c {
			return true
		}
	}
	return false
}

var RotuloCargo = map[Cargo]string{
	CargoAdmin:       "Administrador do sistema",
	CargoDiretoria:   "Diretoria",
	CargoGerente:     "Gerente / Engenheiro",
	CargoOperacional: "Operacional",
	CargoConsulta:    "Consulta",
}

var DescricaoCargo = map[Cargo]string{
	CargoAdmin:       "Cadastra usuários e mexe nas configurações. Faz tudo que os outros fazem.",
	CargoDiretoria:   "Vê tudo e aprova tudo. Não cadastra usuários nem lança no dia a dia.",
	CargoGerente:     "Confere e aprova o que a equipe lançou, nos módulos a que tem acesso.",
	CargoOperacional: "Lança o dia a dia: entradas, saídas, cadastros. Não aprova o próprio lançamento.",
	CargoConsulta:    "Só lê. Serve para quem precisa acompanhar sem poder alterar nada.",
}

type Modulo string

const (
	ModuloPainel      Modulo = "PAINEL"
	ModuloRH          Modulo = "RH"
	ModuloEstoque     Modulo = "ESTOQUE"
	ModuloAlojamentos Modulo = "ALOJAMENTOS"
	ModuloFrota       Modulo = "FROTA"
	ModuloFinanceiro  Modulo = "FINANCEIRO"
	ModuloProgramacao Modulo = "PROGRAMACAO"
	ModuloCompras     Modulo = "COMPRAS"
)

var Modulos = []Modulo{ModuloPainel, ModuloRH, ModuloEstoque, ModuloAlojamentos, ModuloFrota, ModuloFinanceiro, ModuloProgramacao, ModuloCompras}

func (m Modulo) Valido() bool {
	for _, v := range Modulos {
		if v == m {
			return true
		}
	}
	return false
}

var RotuloModulo = map[Modulo]string{
	ModuloPainel:      "Painel de Locação",
	ModuloRH:          "RH e SST",
	ModuloEstoque:     "Almoxarifado",
	ModuloAlojamentos: "Alojamentos",
	ModuloFrota:       "Frota",
	ModuloFinanceiro:  "Financeiro",
	ModuloProgramacao: "Programação Diária",
	ModuloCompras:     "Compras",
}

// Usuario é a única tabela de usuários do conjunto — ver COMPORTAMENTO.md §4.
type Usuario struct {
	ID           string
	Nome         string
	Email        string
	SenhaHash    string
	Cargo        Cargo
	Ativo        bool
	Telefone     *string
	Observacao   *string
	CriadoEm     time.Time
	AtualizadoEm time.Time
	UltimoAcesso *time.Time
	Modulos      []Modulo
}

// Sessao é o que viaja dentro do cookie assinado — ver COMPORTAMENTO.md §2.
type Sessao struct {
	ID      string
	Nome    string
	Email   string
	Cargo   Cargo
	Modulos []Modulo
	// Papel é cópia de Cargo mantida só pra compatibilidade com os apps Next.js ainda não
	// migrados que possam ler o campo antigo — ver COMPORTAMENTO.md §2.
	Papel Cargo
}

// PodeLancar: cria, edita, movimenta.
func PodeLancar(c Cargo) bool {
	return c == CargoAdmin || c == CargoOperacional || c == CargoGerente
}

// PodeAprovar: aprova o que outra pessoa lançou. OPERACIONAL fica de fora de propósito —
// é a separação que faz a aprovação valer alguma coisa ("quem lança não aprova").
func PodeAprovar(c Cargo) bool {
	return c == CargoAdmin || c == CargoGerente || c == CargoDiretoria
}

// PodeAdministrar: usuários, cargos, configurações sensíveis.
func PodeAdministrar(c Cargo) bool {
	return c == CargoAdmin
}

// TemAcesso: ADMIN e DIRETORIA sempre têm acesso a todo módulo, independente do que está
// gravado — ver COMPORTAMENTO.md §3.
func TemAcesso(s Sessao, m Modulo) bool {
	if s.Cargo == CargoAdmin || s.Cargo == CargoDiretoria {
		return true
	}
	for _, x := range s.Modulos {
		if x == m {
			return true
		}
	}
	return false
}
