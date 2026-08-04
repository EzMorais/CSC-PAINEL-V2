package planilha

import (
	"regexp"
	"time"

	"github.com/xuri/excelize/v2"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

var cabecalhosExport = []string{
	"Nº", "DESCRIÇÃO DO EQUIPAMENTO", "Tr Código", "INÍCIO LOCAÇÃO", "FIM LOCAÇÃO",
	"DIAS TOTAIS", "DIAS RESTANTES", "STATUS", "QUAL PERIODO?", "PERIODOS",
	"VALOR DO ITEM", "VALOR GASTO TOTAL", "FORNECEDOR", "QTD", "ESTADO", "OBSERVAÇÕES",
}

var largurasExport = []float64{6, 38, 12, 14, 14, 11, 13, 12, 14, 10, 14, 16, 24, 6, 12, 30}

var corPorStatus = map[dominio.Status]string{
	dominio.StatusVencida:   "FEE2E2",
	dominio.StatusAtencao:   "FEF3C7",
	dominio.StatusAtiva:     "DCFCE7",
	dominio.StatusDevolvida: "F1F5F9",
	dominio.StatusSemPrazo:  "F1F5F9",
}

var reNomeAbaInvalido = regexp.MustCompile(`[:\\/?*\[\]]`)

func sanitizarNomeAba(codigo string) string {
	s := reNomeAbaInvalido.ReplaceAllString(codigo, "-")
	if len(s) > 31 {
		s = s[:31]
	}
	return s
}

func estilizarCabecalho(f *excelize.File, sheet string, linha int, colunas int) {
	estilo, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 10},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"0F172A"}},
		Alignment: &excelize.Alignment{Vertical: "center", Horizontal: "center", WrapText: true},
	})
	inicio, _ := excelize.CoordinatesToCellName(1, linha)
	fim, _ := excelize.CoordinatesToCellName(colunas, linha)
	f.SetCellStyle(sheet, inicio, fim, estilo)
	f.SetRowHeight(sheet, linha, 28)
}

func numFmtMoeda(f *excelize.File) int {
	id, _ := f.NewStyle(&excelize.Style{NumFmt: 44, CustomNumFmt: strPtr(`"R$" #,##0.00`)})
	return id
}

func strPtr(s string) *string { return &s }

// GerarExcel espelha `gerarPlanilha` — ver COMPORTAMENTO.md §7.1.
func GerarExcel(obras []dominio.ObraComLocacoes, hoje time.Time) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", "RESUMO")

	f.SetSheetRow("RESUMO", "A1", &[]any{"CLIENTE", "Nº OBRA", "DESCRIÇÃO DA OBRA", "RESPONSÁVEL", "ITENS ATIVOS", "VALOR EM LOCAÇÃO"})
	estilizarCabecalho(f, "RESUMO", 1, 6)
	for i, largura := range []float64{22, 16, 40, 16, 14, 20} {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth("RESUMO", col, col, largura)
	}

	estiloMoeda := numFmtMoeda(f)
	linha := 2
	totalGeral := 0.0
	for _, o := range obras {
		ativas := filtrarNaoDevolvidas(o.Locacoes)
		valor := somarValorTotal(ativas)
		totalGeral += valor
		responsavel := ""
		if o.Responsavel != nil {
			responsavel = *o.Responsavel
		}
		ref, _ := excelize.CoordinatesToCellName(1, linha)
		f.SetSheetRow("RESUMO", ref, &[]any{o.Cliente, o.Codigo, o.Descricao, responsavel, len(ativas), valor})
		celValor, _ := excelize.CoordinatesToCellName(6, linha)
		f.SetCellStyle("RESUMO", celValor, celValor, estiloMoeda)
		linha++
	}
	refTotal, _ := excelize.CoordinatesToCellName(1, linha)
	f.SetSheetRow("RESUMO", refTotal, &[]any{"", "", "TOTAL GERAL", "", "", totalGeral})
	celValorTotal, _ := excelize.CoordinatesToCellName(6, linha)
	f.SetCellStyle("RESUMO", celValorTotal, celValorTotal, estiloMoeda)
	estiloNegrito, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	celC, _ := excelize.CoordinatesToCellName(3, linha)
	f.SetCellStyle("RESUMO", celC, celC, estiloNegrito)

	estiloData, _ := f.NewStyle(&excelize.Style{NumFmt: 14})
	estiloNegritoGrande, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 12}})
	estiloCinza, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Size: 9, Color: "64748B"}})

	for _, o := range obras {
		nomeAba := sanitizarNomeAba(o.Codigo)
		f.NewSheet(nomeAba)

		f.SetCellValue(nomeAba, "A1", o.Cliente+" — "+o.Codigo+" — "+o.Descricao)
		f.SetCellStyle(nomeAba, "A1", "A1", estiloNegritoGrande)
		f.SetCellValue(nomeAba, "A2", "Emitido em "+dominio.DataLocalBR(hoje))
		f.SetCellStyle(nomeAba, "A2", "A2", estiloCinza)

		r := 4
		f.SetCellValue(nomeAba, cellRef(1, r), "LOCAÇÕES")
		f.SetCellStyle(nomeAba, cellRef(1, r), cellRef(1, r), estiloNegrito)
		r++

		linhaCabecalho := r
		cab := cabecalhosInterface()
		f.SetSheetRow(nomeAba, cellRef(1, r), &cab)
		estilizarCabecalho(f, nomeAba, linhaCabecalho, len(cabecalhosExport))
		r++

		for i, largura := range largurasExport {
			col, _ := excelize.ColumnNumberToName(i + 1)
			f.SetColWidth(nomeAba, col, col, largura)
		}

		naoDevolvidas := filtrarNaoDevolvidas(o.Locacoes)
		for _, l := range naoDevolvidas {
			escreverLinhaLocacao(f, nomeAba, r, l, hoje, estiloData, estiloMoeda)
			r++
		}

		devolvidas := filtrarDevolvidas(o.Locacoes)
		if len(devolvidas) > 0 {
			r++
			f.SetCellValue(nomeAba, cellRef(1, r), "DEVOLUÇÕES")
			f.SetCellStyle(nomeAba, cellRef(1, r), cellRef(1, r), estiloNegrito)
			r++
			cab := cabecalhosInterface()
			f.SetSheetRow(nomeAba, cellRef(1, r), &cab)
			estilizarCabecalho(f, nomeAba, r, len(cabecalhosExport))
			r++
			for _, l := range devolvidas {
				escreverLinhaLocacao(f, nomeAba, r, l, hoje, estiloData, estiloMoeda)
				r++
			}
		}

		f.SetPanes(nomeAba, &excelize.Panes{Freeze: true, YSplit: 5, TopLeftCell: "A6", ActivePane: "bottomLeft"})
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func cellRef(col, linha int) string {
	ref, _ := excelize.CoordinatesToCellName(col, linha)
	return ref
}

func cabecalhosInterface() []any {
	r := make([]any, len(cabecalhosExport))
	for i, c := range cabecalhosExport {
		r[i] = c
	}
	return r
}

func filtrarNaoDevolvidas(locs []dominio.Locacao) []dominio.Locacao {
	var r []dominio.Locacao
	for _, l := range locs {
		if l.DevolvidaEm == nil {
			r = append(r, l)
		}
	}
	return r
}

func filtrarDevolvidas(locs []dominio.Locacao) []dominio.Locacao {
	var r []dominio.Locacao
	for _, l := range locs {
		if l.DevolvidaEm != nil {
			r = append(r, l)
		}
	}
	return r
}

func somarValorTotal(locs []dominio.Locacao) float64 {
	total := 0.0
	for _, l := range locs {
		total += dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim)
	}
	return total
}

func escreverLinhaLocacao(f *excelize.File, sheet string, r int, l dominio.Locacao, hoje time.Time, estiloData, estiloMoeda int) {
	dias := dominio.DuracaoEmDias(l.DataInicio, l.DataFim)
	status := dominio.CalcularStatus(l.DataFim, l.DevolvidaEm, hoje)

	var restantes any = ""
	if l.DevolvidaEm == nil {
		if d := dominio.DiasRestantes(l.DataFim, hoje); d != nil {
			restantes = *d
		}
	}

	var diasCel, periodoCel, periodosCel any = "", "", ""
	if dias > 0 {
		diasCel = dias
		periodoCel = dominio.PeriodoPorDias(dias)
		periodosCel = dominio.QuantidadePeriodos(dias)
	}

	numeroOrigem := ""
	if l.NumeroOrigem != nil {
		numeroOrigem = *l.NumeroOrigem
	}
	trCodigo := ""
	if l.TrCodigo != nil {
		trCodigo = *l.TrCodigo
	}
	fornecedor := ""
	if l.FornecedorNome != nil {
		fornecedor = *l.FornecedorNome
	}
	observacoes := ""
	if l.Observacoes != nil {
		observacoes = *l.Observacoes
	}
	var valorItem any = ""
	if l.ValorItem != nil {
		valorItem = *l.ValorItem
	}

	var dataInicioCel, dataFimCel any = "", ""
	if l.DataInicio != nil {
		dataInicioCel = *l.DataInicio
	}
	if l.DataFim != nil {
		dataFimCel = *l.DataFim
	}

	f.SetSheetRow(sheet, cellRef(1, r), &[]any{
		numeroOrigem, l.Descricao, trCodigo, dataInicioCel, dataFimCel,
		diasCel, restantes, dominio.RotuloStatus[status], periodoCel, periodosCel,
		valorItem, dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim),
		fornecedor, l.Quantidade, string(l.Estado), observacoes,
	})

	if l.DataInicio != nil {
		f.SetCellStyle(sheet, cellRef(4, r), cellRef(4, r), estiloData)
	}
	if l.DataFim != nil {
		f.SetCellStyle(sheet, cellRef(5, r), cellRef(5, r), estiloData)
	}
	f.SetCellStyle(sheet, cellRef(11, r), cellRef(12, r), estiloMoeda)

	cor := corPorStatus[status]
	if cor == "" {
		cor = "FFFFFF"
	}
	estiloStatus, _ := f.NewStyle(&excelize.Style{Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{cor}}})
	f.SetCellStyle(sheet, cellRef(8, r), cellRef(8, r), estiloStatus)
}
