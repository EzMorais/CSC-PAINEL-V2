package rh

import "time"

// Risco de Cargo — COMPORTAMENTO.md §2: ordena/destaca a lista "sem EPI", não força
// exigência automática de EPI/exame (não implementado nem no Next.js).
const (
	RiscoNormal     = "NORMAL"
	RiscoInsalubre  = "INSALUBRE"
	RiscoPericuloso = "PERICULOSO"
)

// Cargo é a PROFISSÃO (Pedreiro, Eletricista) — não confundir com o cargo de sistema
// (ADMIN/GERENTE/...) do Portal, nem com NivelObra (ver funcionario.go).
type Cargo struct {
	ID                     string
	Nome                   string
	CBO                    *string
	Risco                  string
	Descricao              *string
	Responsabilidades      *string
	Requisitos             *string
	DocumentosObrigatorios *string
	Ativo                  bool
	CriadoEm               time.Time
}

// Departamento é o organograma de DOIS NÍVEIS: ramo (PaiID nil) -> setor (PaiID aponta pro
// ramo). Os dois níveis são regra de aplicação, não do schema — COMPORTAMENTO.md §2.
type Departamento struct {
	ID    string
	Nome  string
	PaiID *string
}

// NivelObra — a escada de comando do canteiro, do topo pra base. A ORDEM da lista é a
// hierarquia (ver IndiceNivelObra) — mesma decisão do Next.js (lista fixa em código, não
// tabela): a escada de um canteiro não muda. Eixo independente de Cargo — uma pessoa é
// Pedreiro DE PROFISSÃO e Oficial DE NÍVEL.
var NiveisObra = []string{
	"GERENTE_DE_OBRAS", "ENGENHEIRO", "MESTRE_DE_OBRAS", "ENCARREGADO",
	"OFICIAL", "MEIO_OFICIAL", "SERVENTE_AJUDANTE",
}

func NivelObraValido(v string) bool {
	for _, n := range NiveisObra {
		if n == v {
			return true
		}
	}
	return false
}
