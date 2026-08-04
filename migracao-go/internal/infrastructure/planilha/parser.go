// Package planilha lê a planilha Excel de origem do Painel de Locação — ver
// migracao-go/painel/COMPORTAMENTO.md §6. Único pacote do binário que importa excelize.
package planilha

import (
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

// Índices de coluna (1-based) — mesmos de parser.ts COL. Ver COMPORTAMENTO.md §6.3.
const (
	colNumero     = 1
	colDescricao  = 2
	colTr         = 3
	colInicio     = 4
	colFim        = 5
	colValorItem  = 12
	colFornecedor = 14
	colColuna15   = 15
)

// fimDoBloco: marcadores que encerram o bloco de locações — ver COMPORTAMENTO.md §6.2.
var fimDoBloco = []string{"LEGENDA:", "DEVOLUÇÕES", "DEVOLUCOES", "◂ VOLTAR AO RESUMO"}

func ehFimDoBloco(v string) bool {
	if v == "" {
		return false
	}
	up := strings.ToUpper(v)
	for _, m := range fimDoBloco {
		if strings.Contains(up, m) {
			return true
		}
	}
	return false
}

func texto(f *excelize.File, sheet string, col, row int) *string {
	ref, _ := excelize.CoordinatesToCellName(col, row)
	v, err := f.GetCellValue(sheet, ref)
	if err != nil {
		return nil
	}
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

// dataCelula lê o valor BRUTO (serial numérico do Excel) e converte pra time.Time UTC —
// nunca o texto formatado, que é ambíguo entre M/D e D/M conforme o locale da planilha.
func dataCelula(f *excelize.File, sheet string, col, row int) *time.Time {
	ref, _ := excelize.CoordinatesToCellName(col, row)
	bruto, err := f.GetCellValue(sheet, ref, excelize.Options{RawCellValue: true})
	if err != nil || bruto == "" {
		return nil
	}
	serial, err := strconv.ParseFloat(bruto, 64)
	if err != nil {
		return nil
	}
	t, err := excelize.ExcelDateToTime(serial, false)
	if err != nil {
		return nil
	}
	t = t.UTC()
	return &t
}

func numeroCelula(f *excelize.File, sheet string, col, row int) *float64 {
	ref, _ := excelize.CoordinatesToCellName(col, row)
	bruto, err := f.GetCellValue(sheet, ref, excelize.Options{RawCellValue: true})
	if err == nil && bruto != "" {
		if n, err := strconv.ParseFloat(bruto, 64); err == nil {
			return &n
		}
	}
	// Fallback: célula de texto com número em formato brasileiro ("8,5").
	formatado, err := f.GetCellValue(sheet, ref)
	if err != nil || formatado == "" {
		return nil
	}
	n, err := strconv.ParseFloat(strings.Replace(strings.TrimSpace(formatado), ",", ".", 1), 64)
	if err != nil {
		return nil
	}
	return &n
}

func localizarCabecalho(f *excelize.File, sheet string, totalLinhas int) int {
	limite := totalLinhas
	if limite > 60 {
		limite = 60
	}
	for r := 1; r <= limite; r++ {
		if v := texto(f, sheet, colNumero, r); v != nil && *v == "Nº" {
			return r
		}
	}
	return 0
}

func localizarDevolucoes(f *excelize.File, sheet string, totalLinhas int) int {
	limite := totalLinhas
	if limite > 400 {
		limite = 400
	}
	for r := 1; r <= limite; r++ {
		if v := texto(f, sheet, colNumero, r); v != nil && (*v == "DEVOLUÇÕES" || *v == "DEVOLUCOES") {
			return r
		}
	}
	return 0
}

func lerLinha(f *excelize.File, sheet string, r int, aba, obraCodigo string, obraAConfirmar, devolvida bool) *dominio.LinhaPlanilha {
	descricao := texto(f, sheet, colDescricao, r)
	if descricao == nil {
		return nil
	}
	// Filtra o banner "DEVOLUÇÕES" repetido — ver COMPORTAMENTO.md §6.2.
	if ehFimDoBloco(*descricao) {
		return nil
	}

	c15 := texto(f, sheet, colColuna15, r)
	c15Texto := ""
	if c15 != nil {
		c15Texto = *c15
	}
	quantidade, estado, observacoes := dominio.ClassificarColuna15(c15Texto)

	return &dominio.LinhaPlanilha{
		Aba: aba, Linha: r, ObraCodigo: obraCodigo, ObraAConfirmar: obraAConfirmar, Devolvida: devolvida,
		Descricao:       *descricao,
		NumeroOrigem:    texto(f, sheet, colNumero, r),
		TrCodigo:        texto(f, sheet, colTr, r),
		DataInicio:      dataCelula(f, sheet, colInicio, r),
		DataFim:         dataCelula(f, sheet, colFim, r),
		ValorItem:       numeroCelula(f, sheet, colValorItem, r),
		FornecedorBruto: texto(f, sheet, colFornecedor, r),
		Quantidade:      quantidade, Estado: estado, Observacoes: observacoes,
	}
}

type ResultadoParse struct {
	Linhas    []dominio.LinhaPlanilha
	Ignoradas []dominio.LinhaIgnorada
}

// LerPlanilha abre e interpreta o arquivo — ver COMPORTAMENTO.md §6.1-6.2. `mapa` vem de
// dominio.ConstruirMapaAbas sobre as obras cadastradas.
func LerPlanilha(caminho string, mapa dominio.MapaAbas) (*ResultadoParse, error) {
	f, err := excelize.OpenFile(caminho)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var linhas []dominio.LinhaPlanilha
	var ignoradas []dominio.LinhaIgnorada

	for _, sheet := range f.GetSheetList() {
		if dominio.AbasIgnoradas[sheet] {
			continue
		}

		destino, ok := mapa[sheet]
		if !ok {
			ignoradas = append(ignoradas, dominio.LinhaIgnorada{Aba: sheet, Motivo: "aba sem mapeamento para obra"})
			continue
		}

		linhasAba, err := f.GetRows(sheet)
		if err != nil {
			return nil, err
		}
		totalLinhas := len(linhasAba)

		aConfirmar := len(destino.ObrasCompartilhando) > 0
		cabecalho := localizarCabecalho(f, sheet, totalLinhas)
		if cabecalho == 0 {
			ignoradas = append(ignoradas, dominio.LinhaIgnorada{Aba: sheet, Motivo: `cabeçalho "Nº" não encontrado`})
			continue
		}

		inicioDevolucoes := localizarDevolucoes(f, sheet, totalLinhas)
		fimLocacoes := totalLinhas
		if inicioDevolucoes > 0 {
			fimLocacoes = inicioDevolucoes - 1
		}

		// Bloco LOCAÇÕES
		for r := cabecalho + 1; r <= fimLocacoes; r++ {
			marcador := texto(f, sheet, colNumero, r)
			if marcador != nil && ehFimDoBloco(*marcador) {
				break
			}
			if linha := lerLinha(f, sheet, r, sheet, destino.ObraPrincipal, aConfirmar, false); linha != nil {
				linhas = append(linhas, *linha)
			}
		}

		// Bloco DEVOLUÇÕES — obraAConfirmar sempre false aqui, ver COMPORTAMENTO.md §6.5.
		if inicioDevolucoes > 0 {
			vaziasSeguidas := 0
			for r := inicioDevolucoes + 1; r <= totalLinhas && vaziasSeguidas < 20; r++ {
				linha := lerLinha(f, sheet, r, sheet, destino.ObraPrincipal, false, true)
				if linha != nil {
					linhas = append(linhas, *linha)
					vaziasSeguidas = 0
				} else {
					vaziasSeguidas++
				}
			}
		}
	}

	dominio.MarcarPossiveisDuplicatas(linhas)
	return &ResultadoParse{Linhas: linhas, Ignoradas: ignoradas}, nil
}
