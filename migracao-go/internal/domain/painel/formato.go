package painel

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// BRL formata como o Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}) do
// Node: separador de milhar '.', decimal ',', duas casas.
func BRL(valor *float64) string {
	v := 0.0
	if valor != nil {
		v = *valor
	}
	negativo := v < 0
	if negativo {
		v = -v
	}

	inteiro := int64(v)
	centavos := int64((v-float64(inteiro))*100 + 0.5)
	if centavos >= 100 {
		inteiro++
		centavos -= 100
	}

	milhar := agruparMilhar(inteiro)
	sinal := ""
	if negativo {
		sinal = "-"
	}
	return fmt.Sprintf("%sR$ %s,%02d", sinal, milhar, centavos)
}

func agruparMilhar(n int64) string {
	s := strconv.FormatInt(n, 10)
	if len(s) <= 3 {
		return s
	}
	var partes []string
	for len(s) > 3 {
		partes = append([]string{s[len(s)-3:]}, partes...)
		s = s[:len(s)-3]
	}
	partes = append([]string{s}, partes...)
	return strings.Join(partes, ".")
}

// DataBR formata uma data ARMAZENADA (meia-noite UTC representando um dia de calendário)
// em DD/MM/AAAA — sempre nos componentes UTC, nunca no fuso do processo. nil vira "—".
func DataBR(data *time.Time) string {
	if data == nil {
		return "—"
	}
	u := data.UTC()
	return fmt.Sprintf("%02d/%02d/%04d", u.Day(), u.Month(), u.Year())
}

// DataLocalBR formata um INSTANTE real (ex.: carimbo de emissão de relatório) no fuso da
// construtora — função DIFERENTE de DataBR de propósito, ver COMPORTAMENTO.md §3.4.
func DataLocalBR(instante time.Time) string {
	l := instante.In(Fuso)
	return fmt.Sprintf("%02d/%02d/%04d", l.Day(), l.Month(), l.Year())
}

var (
	reDataBRPadrao = regexp.MustCompile(`^(\d{2})/(\d{2})/(\d{4})$`)
	reDataISO      = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`)
)

// ParseDataBR aceita "31/07/2026" ou "2026-07-31". Devolve nil se não reconhecer.
func ParseDataBR(texto string) *time.Time {
	texto = strings.TrimSpace(texto)
	if m := reDataBRPadrao.FindStringSubmatch(texto); m != nil {
		dia, _ := strconv.Atoi(m[1])
		mes, _ := strconv.Atoi(m[2])
		ano, _ := strconv.Atoi(m[3])
		d := time.Date(ano, time.Month(mes), dia, 0, 0, 0, 0, time.UTC)
		return &d
	}
	if m := reDataISO.FindStringSubmatch(texto); m != nil {
		ano, _ := strconv.Atoi(m[1])
		mes, _ := strconv.Atoi(m[2])
		dia, _ := strconv.Atoi(m[3])
		d := time.Date(ano, time.Month(mes), dia, 0, 0, 0, 0, time.UTC)
		return &d
	}
	return nil
}
