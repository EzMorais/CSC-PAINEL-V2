package painel

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// LinhaPlanilha é uma linha interpretada da planilha de origem — ver COMPORTAMENTO.md §6.
type LinhaPlanilha struct {
	Aba               string
	Linha             int
	NumeroOrigem      *string
	Descricao         string
	TrCodigo          *string
	DataInicio        *time.Time
	DataFim           *time.Time
	ValorItem         *float64
	FornecedorBruto   *string
	Devolvida         bool
	ObraCodigo        string
	ObraAConfirmar    bool
	PossivelDuplicata bool

	Quantidade  *int
	Estado      *Estado
	Observacoes *string
}

type LinhaIgnorada struct {
	Aba    string
	Linha  int
	Motivo string
}

// DestinoAba diz pra qual obra vão os itens de uma aba, e se ela é compartilhada — ver
// COMPORTAMENTO.md §6.5.
type DestinoAba struct {
	ObraPrincipal       string
	ObrasCompartilhando []string
}

type MapaAbas map[string]DestinoAba

// AbasIgnoradas existem no arquivo mas não contêm locações.
var AbasIgnoradas = map[string]bool{"RESUMO": true}

// ConstruirMapaAbas monta o mapa aba->obra a partir das obras cadastradas (campo AbaOrigem).
// `obras` deve vir ordenada por código — a ordem decide qual obra é a principal quando duas
// dividem a mesma aba.
func ConstruirMapaAbas(obras []Obra) MapaAbas {
	porAba := map[string][]string{}
	var ordemAbas []string
	for _, o := range obras {
		if _, ok := porAba[o.AbaOrigem]; !ok {
			ordemAbas = append(ordemAbas, o.AbaOrigem)
		}
		porAba[o.AbaOrigem] = append(porAba[o.AbaOrigem], o.Codigo)
	}

	mapa := MapaAbas{}
	for _, aba := range ordemAbas {
		codigos := porAba[aba]
		destino := DestinoAba{ObraPrincipal: codigos[0]}
		if len(codigos) > 1 {
			destino.ObrasCompartilhando = codigos
		}
		mapa[aba] = destino
	}
	return mapa
}

var reIgnorarColuna15 = regexp.MustCompile(`(?i)^(unidades|observa[çc][õo]es|obs)$`)
var reNumero = regexp.MustCompile(`^\d+([.,]\d+)?$`)
var rePerdido = regexp.MustCompile(`(?i)^perdid[oa]s?$`)
var reOK = regexp.MustCompile(`(?i)^ok$`)
var reDanificado = regexp.MustCompile(`(?i)^danificad[oa]s?$`)

// ClassificarColuna15 decide o que uma célula de texto livre significa — ver
// COMPORTAMENTO.md §6.4: número vira quantidade, palavra de estado vira Estado, resto vira
// observação.
func ClassificarColuna15(bruto string) (quantidade *int, estado *Estado, observacoes *string) {
	texto := strings.TrimSpace(bruto)
	if texto == "" || reIgnorarColuna15.MatchString(texto) {
		return nil, nil, nil
	}

	if reNumero.MatchString(texto) {
		n, err := strconv.ParseFloat(strings.Replace(texto, ",", ".", 1), 64)
		if err == nil {
			arredondado := int(n + 0.5)
			if arredondado > 0 {
				return &arredondado, nil, nil
			}
		}
		return nil, nil, nil
	}

	switch {
	case rePerdido.MatchString(texto):
		e := EstadoPerdido
		return nil, &e, nil
	case reOK.MatchString(texto):
		e := EstadoOK
		return nil, &e, nil
	case reDanificado.MatchString(texto):
		e := EstadoDanificado
		return nil, &e, nil
	}

	return nil, nil, &texto
}

// NormalizarTexto: maiúsculas, sem diacrítico, trim — usado para comparar nomes de
// fornecedor e descrições de equipamento entre si.
func NormalizarTexto(s string) string {
	var b strings.Builder
	for _, r := range removerDiacriticos(s) {
		b.WriteRune(unicode.ToUpper(r))
	}
	return strings.TrimSpace(b.String())
}

// NormalizarDescricao é NormalizarTexto + colapso de espaços internos — usado nas
// assinaturas de deduplicação (COMPORTAMENTO.md §6.6), onde espaço duplicado não pode
// distinguir duas linhas que descrevem o mesmo equipamento.
func NormalizarDescricao(s string) string {
	campos := strings.Fields(NormalizarTexto(s))
	return strings.Join(campos, " ")
}

func removerDiacriticos(s string) string {
	subst := map[rune]rune{
		'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
		'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
		'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
		'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
		'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
		'ç': 'c', 'ñ': 'n',
		'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A',
		'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
		'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
		'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
		'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
		'Ç': 'C', 'Ñ': 'N',
	}
	var b strings.Builder
	for _, r := range s {
		if s2, ok := subst[r]; ok {
			b.WriteRune(s2)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func valorTexto(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func dataISO(d *time.Time) string {
	if d == nil {
		return ""
	}
	return d.UTC().Format("2006-01-02T15:04:05.000Z")
}

// AssinaturaAtivo identifica um item ativo pra fins de detecção de duplicata entre abas —
// ver COMPORTAMENTO.md §6.6.
func AssinaturaAtivo(l LinhaPlanilha) string {
	return NormalizarDescricao(l.Descricao) + "|" + valorTexto(l.TrCodigo)
}

// AssinaturaDevolvida é igual à de ativo mas troca Tr por data+valor, e PROPOSITALMENTE
// não inclui dataFim — ver COMPORTAMENTO.md §6.6.
func AssinaturaDevolvida(l LinhaPlanilha) string {
	valor := ""
	if l.ValorItem != nil {
		valor = strconv.FormatFloat(*l.ValorItem, 'f', -1, 64)
	}
	inicio := ""
	if l.DataInicio != nil {
		inicio = strconv.FormatInt(l.DataInicio.UTC().UnixMilli(), 10)
	}
	return NormalizarDescricao(l.Descricao) + "|" + valorTexto(l.TrCodigo) + "|" + inicio + "|" + valor
}

// MarcarPossiveisDuplicatas marca (em memória, mutando o slice) toda linha cuja assinatura
// apareça em mais de uma aba — ativos e devolvidos são espaços separados, nunca cruzam.
func MarcarPossiveisDuplicatas(linhas []LinhaPlanilha) {
	marcarGrupo := func(indices []int, assinatura func(LinhaPlanilha) string) {
		abasPorAssinatura := map[string]map[string]bool{}
		for _, i := range indices {
			chave := assinatura(linhas[i])
			if abasPorAssinatura[chave] == nil {
				abasPorAssinatura[chave] = map[string]bool{}
			}
			abasPorAssinatura[chave][linhas[i].Aba] = true
		}
		for _, i := range indices {
			if len(abasPorAssinatura[assinatura(linhas[i])]) > 1 {
				linhas[i].PossivelDuplicata = true
			}
		}
	}

	var ativos, devolvidos []int
	for i, l := range linhas {
		if l.Devolvida {
			devolvidos = append(devolvidos, i)
		} else {
			ativos = append(ativos, i)
		}
	}
	marcarGrupo(ativos, AssinaturaAtivo)
	marcarGrupo(devolvidos, AssinaturaDevolvida)
}

// ChaveIdempotencia identifica uma locação de forma estável entre reimportações do mesmo
// arquivo — ver COMPORTAMENTO.md §6.6. `obraID` já resolvido pelo chamador.
func ChaveIdempotencia(obraID, descricao string, trCodigo *string, dataInicio *time.Time, numeroOrigem *string) string {
	return strings.Join([]string{
		obraID, NormalizarDescricao(descricao), valorTexto(trCodigo), dataISO(dataInicio), valorTexto(numeroOrigem),
	}, "|")
}
