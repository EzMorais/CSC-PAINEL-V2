// Package relatorio gera o PDF de locações ativas — ver
// migracao-go/painel/COMPORTAMENTO.md §7.2. Único pacote do binário que importa fpdf.
package relatorio

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

type coluna struct {
	titulo  string
	largura float64
	direita bool
}

var colunas = []coluna{
	{"Equipamento", 180, false},
	{"Tr", 55, false},
	{"Fornecedor", 130, false},
	{"Início", 62, false},
	{"Fim", 62, false},
	{"Situação", 95, false},
	{"Total", 78, true},
}

var corStatusPDF = map[dominio.Status][3]int{
	dominio.StatusVencida:   {220, 38, 38},
	dominio.StatusAtencao:   {217, 119, 6},
	dominio.StatusAtiva:     {22, 163, 74},
	dominio.StatusSemPrazo:  {100, 116, 139},
	dominio.StatusDevolvida: {100, 116, 139},
}

func cortar(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// GerarPDF espelha `gerarPdf` — ver COMPORTAMENTO.md §7.2. Só obras ativas com locações
// não devolvidas.
func GerarPDF(obras []dominio.ObraComLocacoes, hoje time.Time) ([]byte, error) {
	pdf := fpdf.New("L", "pt", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	larguraUtil, _ := pdf.GetPageSize()
	larguraUtil -= 64

	primeira := true
	for _, o := range obras {
		naoDevolvidas := filtrarNaoDevolvidas(o.Locacoes)
		if len(naoDevolvidas) == 0 {
			continue
		}
		pdf.AddPage()
		primeira = false

		pdf.SetTextColor(15, 23, 42)
		pdf.SetFont("Helvetica", "", 15)
		pdf.SetXY(32, 30)
		pdf.CellFormat(larguraUtil, 18, tr("Construtora Siqueira Campos"), "", 0, "L", false, 0, "")

		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(100, 116, 139)
		pdf.SetXY(32, 48)
		pdf.CellFormat(larguraUtil, 12, tr(fmt.Sprintf("Painel de Locação · emitido em %s", dominio.DataLocalBR(hoje))), "", 0, "L", false, 0, "")

		pdf.SetFont("Helvetica", "", 12)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(32, 68)
		pdf.CellFormat(larguraUtil, 16, tr(fmt.Sprintf("%s — %s", o.Cliente, o.Codigo)), "", 0, "L", false, 0, "")

		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(100, 116, 139)
		pdf.SetXY(32, 84)
		pdf.CellFormat(larguraUtil, 12, tr(o.Descricao), "", 0, "L", false, 0, "")

		y := desenharCabecalhoTabela(pdf, tr, 100, larguraUtil)
		pagina := 1
		total := 0.0

		for i, l := range naoDevolvidas {
			if y > 595-70 {
				pdf.AddPage()
				pagina++
				y = 40
				pdf.SetFont("Helvetica", "", 9)
				pdf.SetTextColor(100, 116, 139)
				pdf.SetXY(32, y)
				pdf.CellFormat(larguraUtil, 12, tr(fmt.Sprintf("%s — %s (continuação, página %d)", o.Cliente, o.Codigo, pagina)), "", 0, "L", false, 0, "")
				y += 16
				y = desenharCabecalhoTabela(pdf, tr, y, larguraUtil)
			}

			status := dominio.CalcularStatus(l.DataFim, l.DevolvidaEm, hoje)
			valor := dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim)
			total += valor

			if i%2 == 0 {
				pdf.SetFillColor(248, 250, 252)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
			pdf.Rect(32, y, larguraUtil, 16, "F")

			trCodigo, fornecedor := "—", "—"
			if l.TrCodigo != nil {
				trCodigo = *l.TrCodigo
			}
			if l.FornecedorNome != nil {
				fornecedor = *l.FornecedorNome
			}
			celulas := []string{
				cortar(l.Descricao, 42), trCodigo, cortar(fornecedor, 26),
				dominio.DataBR(l.DataInicio), dominio.DataBR(l.DataFim),
				dominio.RotuloVencimento(l.DataFim, hoje), dominio.BRL(&valor),
			}

			x := 36.0
			pdf.SetFont("Helvetica", "", 7.5)
			for ci, texto := range celulas {
				if ci == 5 {
					cor := corStatusPDF[status]
					pdf.SetTextColor(cor[0], cor[1], cor[2])
				} else {
					pdf.SetTextColor(31, 35, 40)
				}
				align := "L"
				if colunas[ci].direita {
					align = "R"
				}
				pdf.SetXY(x, y+3)
				pdf.CellFormat(colunas[ci].largura-6, 10, tr(texto), "", 0, align, false, 0, "")
				x += colunas[ci].largura
			}
			y += 16
		}

		pdf.SetFillColor(241, 245, 249)
		pdf.Rect(32, y, larguraUtil, 18, "F")
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(36, y+4)
		pdf.CellFormat(200, 12, tr(fmt.Sprintf("%d itens ativos", len(naoDevolvidas))), "", 0, "L", false, 0, "")
		pdf.SetXY(36, y+4)
		pdf.CellFormat(larguraUtil-8, 12, tr(dominio.BRL(&total)), "", 0, "R", false, 0, "")
	}

	if primeira {
		pdf.AddPage()
		pdf.SetFont("Helvetica", "", 12)
		pdf.SetTextColor(100, 116, 139)
		pdf.SetXY(32, 40)
		pdf.CellFormat(400, 16, tr("Nenhuma locação ativa no momento."), "", 0, "L", false, 0, "")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func desenharCabecalhoTabela(pdf *fpdf.Fpdf, tr func(string) string, topo, larguraUtil float64) float64 {
	pdf.SetFillColor(15, 23, 42)
	pdf.Rect(32, topo, larguraUtil, 18, "F")
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(255, 255, 255)
	x := 36.0
	for _, c := range colunas {
		align := "L"
		if c.direita {
			align = "R"
		}
		pdf.SetXY(x, topo+5)
		pdf.CellFormat(c.largura-6, 10, tr(c.titulo), "", 0, align, false, 0, "")
		x += c.largura
	}
	return topo + 18
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
