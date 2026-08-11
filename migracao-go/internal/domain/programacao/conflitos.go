package programacao

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Conflito é o que está errado no quadro — função pura, sem banco. Existe porque é
// justamente isto que o Excel/WhatsApp não fazem: o mesmo carro entra em duas frentes e
// ninguém percebe até de manhã, com duas turmas esperando o mesmo veículo.
//
// Tudo aqui é AVISO, não impedimento. Escalar o mesmo carro em duas frentes pode ser
// proposital (leva a turma e volta) — travar o quadro faria o chefe voltar pro Excel, onde
// nada trava. Mostrar e deixar decidir é o que mantém a ferramenta em uso.
type Gravidade string

const (
	GravidadeAlta  Gravidade = "alta"
	GravidadeMedia Gravidade = "media"
)

type Conflito struct {
	Gravidade Gravidade
	Titulo    string
	Detalhe   string
	FrenteIDs []string
}

var reNaoAlfanumerico = regexp.MustCompile(`[^a-zA-Z0-9]`)

func normalizar(t string) string {
	return strings.ToLower(strings.TrimSpace(t))
}

func somentePlaca(p string) string {
	return strings.ToUpper(reNaoAlfanumerico.ReplaceAllString(p, ""))
}

// ConferirQuadro recebe as escalas e recursos já carregados de um dia e devolve os
// conflitos encontrados, mais graves primeiro. veiculosEmManutencao é opcional (a Frota
// segue fora da migração — ver README "Frota fora do escopo"); passe nil quando não tiver
// como consultar.
func ConferirQuadro(escalas []Escala, recursos []Recurso, frentes []Frente, veiculosEmManutencao map[string]string) []Conflito {
	nomeDaFrente := map[string]string{}
	for _, f := range frentes {
		nomeDaFrente[f.ID] = f.Nome
	}
	rotulo := func(id string) string {
		if n, ok := nomeDaFrente[id]; ok {
			return n
		}
		return "?"
	}
	juntar := func(ids []string) string {
		nomes := make([]string, len(ids))
		for i, id := range ids {
			nomes[i] = rotulo(id)
		}
		return strings.Join(nomes, " e ")
	}

	var conflitos []Conflito

	// ── Mesma pessoa em duas frentes ───────────────────────────────────────────
	frentesPorPessoa := map[string]map[string]bool{}
	nomeOriginal := map[string]string{}
	ordemPessoa := []string{}
	for _, e := range escalas {
		chave := normalizar(e.Nome)
		if frentesPorPessoa[chave] == nil {
			frentesPorPessoa[chave] = map[string]bool{}
			nomeOriginal[chave] = e.Nome
			ordemPessoa = append(ordemPessoa, chave)
		}
		frentesPorPessoa[chave][e.FrenteID] = true
	}
	for _, chave := range ordemPessoa {
		ids := chavesOrdenadas(frentesPorPessoa[chave])
		if len(ids) < 2 {
			continue
		}
		conflitos = append(conflitos, Conflito{
			Gravidade: GravidadeAlta,
			Titulo:    nomeOriginal[chave] + " está em " + strconv.Itoa(len(ids)) + " frentes",
			Detalhe:   juntar(ids),
			FrenteIDs: ids,
		})
	}

	// ── Mesmo veículo em duas frentes ──────────────────────────────────────────
	frentesPorPlaca := map[string]map[string]bool{}
	placaOriginal := map[string]string{}
	ordemPlaca := []string{}
	for _, r := range recursos {
		if r.Tipo != RecursoVeiculo || r.Placa == nil || *r.Placa == "" {
			continue
		}
		chave := somentePlaca(*r.Placa)
		if frentesPorPlaca[chave] == nil {
			frentesPorPlaca[chave] = map[string]bool{}
			placaOriginal[chave] = chave
			ordemPlaca = append(ordemPlaca, chave)
		}
		frentesPorPlaca[chave][r.FrenteID] = true
	}
	for _, chave := range ordemPlaca {
		ids := chavesOrdenadas(frentesPorPlaca[chave])
		if len(ids) < 2 {
			continue
		}
		conflitos = append(conflitos, Conflito{
			Gravidade: GravidadeAlta,
			Titulo:    "Veículo " + placaOriginal[chave] + " em " + strconv.Itoa(len(ids)) + " frentes",
			Detalhe:   juntar(ids),
			FrenteIDs: ids,
		})
	}

	// ── Veículo com manutenção aberta na Frota ─────────────────────────────────
	for _, r := range recursos {
		if r.Tipo != RecursoVeiculo || r.Placa == nil || *r.Placa == "" {
			continue
		}
		motivo, emManutencao := veiculosEmManutencao[somentePlaca(*r.Placa)]
		if !emManutencao {
			continue
		}
		if motivo == "" {
			motivo = "manutenção aberta na Frota"
		}
		conflitos = append(conflitos, Conflito{
			Gravidade: GravidadeAlta,
			Titulo:    r.Descricao + " está em manutenção",
			Detalhe:   rotulo(r.FrenteID) + " · " + motivo,
			FrenteIDs: []string{r.FrenteID},
		})
	}

	// ── Motorista escalado em outra frente (ou não escalado) ───────────────────
	for _, r := range recursos {
		if r.MotoristaNome == nil || strings.TrimSpace(*r.MotoristaNome) == "" {
			continue
		}
		alvo := normalizar(*r.MotoristaNome)
		var ondeEsta []string
		for _, e := range escalas {
			if normalizar(e.Nome) == alvo {
				ondeEsta = append(ondeEsta, e.FrenteID)
			}
		}
		if len(ondeEsta) == 0 {
			conflitos = append(conflitos, Conflito{
				Gravidade: GravidadeMedia,
				Titulo:    *r.MotoristaNome + " dirige mas não está escalado",
				Detalhe:   r.Descricao + " · " + rotulo(r.FrenteID),
				FrenteIDs: []string{r.FrenteID},
			})
			continue
		}
		if !contem(ondeEsta, r.FrenteID) {
			conflitos = append(conflitos, Conflito{
				Gravidade: GravidadeMedia,
				Titulo:    *r.MotoristaNome + " dirige em uma frente e trabalha em outra",
				Detalhe:   r.Descricao + " está em " + rotulo(r.FrenteID) + ", e ele está escalado em " + juntar(ondeEsta),
				FrenteIDs: append([]string{r.FrenteID}, ondeEsta...),
			})
		}
	}

	// ── Veículo sem motorista ──────────────────────────────────────────────────
	for _, r := range recursos {
		if r.Tipo != RecursoVeiculo {
			continue
		}
		if r.MotoristaNome != nil && strings.TrimSpace(*r.MotoristaNome) != "" {
			continue
		}
		conflitos = append(conflitos, Conflito{
			Gravidade: GravidadeMedia,
			Titulo:    r.Descricao + " sem motorista",
			Detalhe:   rotulo(r.FrenteID),
			FrenteIDs: []string{r.FrenteID},
		})
	}

	return ordenarPorGravidade(conflitos)
}

func chavesOrdenadas(m map[string]bool) []string {
	xs := make([]string, 0, len(m))
	for k := range m {
		xs = append(xs, k)
	}
	return xs
}
func contem(xs []string, alvo string) bool {
	for _, x := range xs {
		if x == alvo {
			return true
		}
	}
	return false
}
func ordenarPorGravidade(cs []Conflito) []Conflito {
	peso := map[Gravidade]int{GravidadeAlta: 0, GravidadeMedia: 1}
	out := make([]Conflito, len(cs))
	copy(out, cs)
	sort.SliceStable(out, func(i, j int) bool { return peso[out[i].Gravidade] < peso[out[j].Gravidade] })
	return out
}
