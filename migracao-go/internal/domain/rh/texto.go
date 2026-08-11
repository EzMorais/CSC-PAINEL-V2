package rh

import (
	"strings"
	"unicode"
)

// removerDiacriticos troca vogais acentuadas/cedilha pela base ASCII — usado nas duas
// normalizações abaixo. Cópia pontual do mesmo utilitário em domain/painel: os dois
// domínios não se importam entre si (ARQUITETURA.md §1), e o conjunto de caracteres é curto
// o bastante para não valer a pena promovê-lo a domain/comum por enquanto.
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

// NormalizarChave espelha `normalizar` de actions/importar-funcionarios.ts — minúsculo, sem
// acento, sem espaço nas pontas. Usado para achar cargo/obra já cadastrados por nome durante
// a importação (COMPORTAMENTO.md §5), não para exibição.
func NormalizarChave(s string) string {
	return strings.TrimSpace(strings.ToLower(removerDiacriticos(s)))
}

// NormalizarCabecalho espelha `normalizar` de lib/planilha/funcionarios.ts — além de minúsculo
// e sem acento, troca tudo que não é letra/número por espaço e colapsa espaços repetidos.
// Usado só para reconhecer o APELIDO de uma coluna do cabeçalho, nunca para dado de pessoa.
func NormalizarCabecalho(s string) string {
	semAcento := removerDiacriticos(strings.ToLower(s))
	var b strings.Builder
	espacoAnterior := false
	for _, r := range semAcento {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			espacoAnterior = false
		} else if !espacoAnterior {
			b.WriteRune(' ')
			espacoAnterior = true
		}
	}
	return strings.TrimSpace(b.String())
}
