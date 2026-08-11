package relatorio

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"

	"siqueiracampos/servidor/internal/domain/comum"
)

// ResumoSST — indicadores já contados pela camada de aplicação (GerenciadorRelatorios) —
// este pacote só desenha, mesma separação de GerarPDF para o Painel.
type ResumoSST struct {
	Ativos, Afastados, Ferias            int
	TreinamentosVencendo, ExamesVencendo int
	NCAbertas, NCVencidas                int
	Auditorias                           int
}

// GerarResumoSST espelha `gerarResumoPdf` — ver migracao-go/rh/COMPORTAMENTO.md §7. PDF de
// página única, A4 retrato — layout mais simples que o do Painel (é uma lista de KPIs, não
// uma tabela de linhas).
func GerarResumoSST(r ResumoSST, hoje time.Time) ([]byte, error) {
	pdf := fpdf.New("P", "pt", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.AddPage()

	margem := 50.0
	largura := 495.0
	y := margem

	pdf.SetTextColor(15, 23, 42)
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetXY(margem, y)
	pdf.CellFormat(largura, 22, tr("Resumo de RH e SST — Siqueira Campos"), "", 0, "L", false, 0, "")
	y += 26

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(100, 116, 139)
	pdf.SetXY(margem, y)
	pdf.CellFormat(largura, 14, tr("Emitido em "+comum.DataLocalBR(hoje)), "", 0, "L", false, 0, "")
	y += 34

	secao := func(titulo string) {
		pdf.SetFont("Helvetica", "B", 13)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(margem, y)
		pdf.CellFormat(largura, 16, tr(titulo), "", 0, "L", false, 0, "")
		y += 22
	}
	linha := func(rotulo string, valor int) {
		pdf.SetFont("Helvetica", "B", 11)
		pdf.SetTextColor(0, 0, 0)
		pdf.SetXY(margem, y)
		pdf.CellFormat(280, 14, tr(rotulo), "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 11)
		pdf.SetXY(margem+280, y)
		pdf.CellFormat(100, 14, fmt.Sprintf("%d", valor), "", 0, "L", false, 0, "")
		y += 18
	}

	secao("Efetivo")
	linha("Ativos:", r.Ativos)
	linha("Afastados:", r.Afastados)
	linha("Em férias:", r.Ferias)
	y += 12

	secao("Segurança do trabalho")
	linha("Treinamentos vencendo em 30 dias:", r.TreinamentosVencendo)
	linha("Exames (ASO) vencendo em 30 dias:", r.ExamesVencendo)
	linha("Não conformidades em aberto:", r.NCAbertas)
	linha("Não conformidades com prazo vencido:", r.NCVencidas)
	linha("Auditorias realizadas:", r.Auditorias)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
