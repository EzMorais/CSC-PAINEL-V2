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
	// PapelFinanceiro aplica ao usuário a separação tesouraria/aprovação do módulo
	// Financeiro. Vazio ou NENHUM = vale a regra global de cargo — ver acima.
	PapelFinanceiro PapelFinanceiro
}

// PapelFinanceiro separa, dentro do módulo Financeiro, quem opera a tesouraria (lança e
// baixa) de quem aprova. Um papel dedicado evita que a aprovação e a tesouraria caiam na
// mesma pessoa só porque o cargo global dela permite ambos — ver BRIEFING_FINANCEIRO_COMPRAS.md §2.1.
type PapelFinanceiro string

const (
	// PapelFinanceiroNenhum é o padrão (vazio também conta como nenhum): sem papel dedicado,
	// valem as regras globais de cargo dentro do Financeiro.
	PapelFinanceiroNenhum     PapelFinanceiro = "NENHUM"
	PapelFinanceiroTesouraria PapelFinanceiro = "TESOURARIA"
	PapelFinanceiroAprovacao  PapelFinanceiro = "APROVACAO"
	PapelFinanceiroGestao     PapelFinanceiro = "GESTAO"
)

// PapeisFinanceiro lista os papéis válidos nesta ordem — a ordem importa pros <select> da UI.
var PapeisFinanceiro = []PapelFinanceiro{PapelFinanceiroNenhum, PapelFinanceiroTesouraria, PapelFinanceiroAprovacao, PapelFinanceiroGestao}

func (p PapelFinanceiro) Valido() bool {
	for _, v := range PapeisFinanceiro {
		if v == p {
			return true
		}
	}
	return false
}

var RotuloPapelFinanceiro = map[PapelFinanceiro]string{
	PapelFinanceiroNenhum:     "Regra do cargo",
	PapelFinanceiroTesouraria: "Tesouraria",
	PapelFinanceiroAprovacao:  "Aprovação",
	PapelFinanceiroGestao:     "Gestão do Financeiro",
}

var DescricaoPapelFinanceiro = map[PapelFinanceiro]string{
	PapelFinanceiroNenhum:     "Sem papel dedicado — vale a regra geral do cargo no Financeiro.",
	PapelFinanceiroTesouraria: "Lança e baixa títulos, mas não aprova nem administra.",
	PapelFinanceiroAprovacao:  "Aprova títulos e estornos, mas não lança tesouraria.",
	PapelFinanceiroGestao:     "Tesouraria + aprovação + fechamento de competência.",
}

// FinanceiroPodeLancar: quem opera a tesouraria (lançar/baixar). Com papel dedicado, o
// papel decide; sem papel dedicado, vale a regra global de cargo (PodeLancar).
func FinanceiroPodeLancar(s Sessao) bool {
	switch s.PapelFinanceiro {
	case PapelFinanceiroTesouraria, PapelFinanceiroGestao:
		return true
	case PapelFinanceiroAprovacao:
		return false
	}
	return PodeLancar(s.Cargo)
}

// FinanceiroPodeAprovar: quem aprova títulos e estornos. Papel dedicado decide; sem papel,
// vale a regra global (PodeAprovar).
func FinanceiroPodeAprovar(s Sessao) bool {
	switch s.PapelFinanceiro {
	case PapelFinanceiroAprovacao, PapelFinanceiroGestao:
		return true
	case PapelFinanceiroTesouraria:
		return false
	}
	return PodeAprovar(s.Cargo)
}

// FinanceiroPodeAdministrar: fecha/reabre competência e mexe em contas. Papel dedicado
// (GESTAO) decide; sem papel, vale a regra global (somente ADMIN).
func FinanceiroPodeAdministrar(s Sessao) bool {
	if s.PapelFinanceiro == PapelFinanceiroGestao {
		return true
	}
	return PodeAdministrar(s.Cargo)
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
	// PapelFinanceiro separa tesouraria de aprovação dentro do Financeiro — ver acima.
	PapelFinanceiro PapelFinanceiro
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
