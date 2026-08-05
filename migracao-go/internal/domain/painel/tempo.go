package painel

import (
	"fmt"
	"time"

	"siqueiracampos/servidor/internal/domain/comum"
)

// Fuso é o fuso horário de "hoje" nas regras de negócio deste módulo — ver
// COMPORTAMENTO.md §3.1: "hoje" é o dia de quem está olhando a tela (Brasil), não UTC.
// Vive em internal/domain/comum (compartilhado com o Almoxarifado); alias mantido para não
// obrigar o resto do pacote painel a trocar de nome.
var Fuso = comum.Fuso

const diaMS = 86_400_000

// diaArmazenado é o número do dia de uma data ARMAZENADA (Excel, banco): essas datas são
// meia-noite UTC representando um dia de calendário — ler em fuso local jogaria pro dia
// anterior no Brasil. Ver COMPORTAMENTO.md §2.
func diaArmazenado(d time.Time) int64 {
	u := d.UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC).UnixMilli() / diaMS
}

// diaDeHoje é o número do dia de AGORA no fuso de quem está olhando a tela — aqui os
// componentes LOCAIS (Fuso) são os certos, ao contrário de diaArmazenado.
func diaDeHoje(d time.Time) int64 {
	l := d.In(Fuso)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC).UnixMilli() / diaMS
}

// DiasRestantes: dias até o fim da locação. Negativo = vencida há N dias. nil = sem prazo.
func DiasRestantes(dataFim *time.Time, hoje time.Time) *int {
	if dataFim == nil {
		return nil
	}
	n := int(diaArmazenado(*dataFim) - diaDeHoje(hoje))
	return &n
}

// LimiteEmDias devolve o limite de data para filtrar por status em SQL, no mesmo
// referencial UTC-meia-noite em que dataFim está gravada.
func LimiteEmDias(dias int, hoje time.Time) time.Time {
	return time.UnixMilli((diaDeHoje(hoje) + int64(dias)) * diaMS).UTC()
}

func CalcularStatus(dataFim, devolvidaEm *time.Time, hoje time.Time) Status {
	if devolvidaEm != nil {
		return StatusDevolvida
	}
	dias := DiasRestantes(dataFim, hoje)
	if dias == nil {
		return StatusSemPrazo
	}
	if *dias < 0 {
		return StatusVencida
	}
	if *dias <= DiasAtencao {
		return StatusAtencao
	}
	return StatusAtiva
}

// RotuloVencimento é o texto curto pra coluna de vencimento — "vence em 3 dias",
// "vencida há 12 dias", "vence hoje", "sem prazo".
func RotuloVencimento(dataFim *time.Time, hoje time.Time) string {
	dias := DiasRestantes(dataFim, hoje)
	if dias == nil {
		return "sem prazo"
	}
	switch {
	case *dias < 0:
		n := -*dias
		if n == 1 {
			return "vencida há 1 dia"
		}
		return fmt.Sprintf("vencida há %d dias", n)
	case *dias == 0:
		return "vence hoje"
	case *dias == 1:
		return "vence em 1 dia"
	default:
		return fmt.Sprintf("vence em %d dias", *dias)
	}
}

// DuracaoEmDias usa dias de CALENDÁRIO (diferença de dia-armazenado), não horas/24.
func DuracaoEmDias(inicio, fim *time.Time) int {
	if inicio == nil || fim == nil {
		return 0
	}
	return int(diaArmazenado(*fim) - diaArmazenado(*inicio))
}

// PeriodoPorDias classifica a duração em nome de período — coluna J da planilha original.
func PeriodoPorDias(dias int) string {
	switch {
	case dias <= 1:
		return "Diário"
	case dias <= 7:
		return "Semanal"
	case dias <= 15:
		return "Quinzenal"
	default:
		return "Mensal"
	}
}

// QuantidadePeriodos: quantos períodos cabem na duração, arredondando para cima — coluna K.
func QuantidadePeriodos(dias int) int {
	switch PeriodoPorDias(dias) {
	case "Diário":
		return dias
	case "Semanal":
		return ceilDiv(dias, 7)
	case "Quinzenal":
		return ceilDiv(dias, 15)
	default:
		return ceilDiv(dias, 30)
	}
}

func ceilDiv(a, b int) int {
	if a <= 0 {
		return 0
	}
	return (a + b - 1) / b
}

// ValorTotal: valor do item multiplicado pela quantidade de períodos — coluna M.
func ValorTotal(valorItem *float64, inicio, fim *time.Time) float64 {
	if valorItem == nil || *valorItem == 0 {
		return 0
	}
	dias := DuracaoEmDias(inicio, fim)
	if dias <= 0 {
		return *valorItem
	}
	return *valorItem * float64(QuantidadePeriodos(dias))
}
