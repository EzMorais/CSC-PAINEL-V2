package planilha

import (
	"github.com/xuri/excelize/v2"
)

var cabecalhosFuncionarios = []string{
	"Matrícula", "Nome", "CPF", "Obra", "Cargo", "Situação", "Admissão", "Telefone", "Cidade", "UF",
}
var largurasFuncionarios = []float64{12, 32, 16, 14, 22, 12, 14, 16, 18, 6}

// LinhaExportFuncionario já vem com Obra/Cargo/Situação resolvidos para texto — o pacote
// planilha não conhece o domínio rh, só escreve o que a camada de aplicação preparou (mesma
// separação de GerarExcel para o Painel, que recebe dominio.ObraComLocacoes já pronto).
type LinhaExportFuncionario struct {
	Matricula, Nome, CPF, Obra, Cargo, Situacao, Admissao, Telefone, Cidade, UF string
}

// GerarPlanilhaFuncionarios espelha `gerarPlanilhaFuncionarios` — ver COMPORTAMENTO.md §7.
// `linhas` vazio gera o modelo (mesmas colunas, nenhuma linha de dado): é a MESMA função para
// os dois casos, de propósito — modelo e relatório real não podem divergir de coluna.
func GerarPlanilhaFuncionarios(linhas []LinhaExportFuncionario) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "FUNCIONÁRIOS"
	f.SetSheetName("Sheet1", sheet)

	cab := make([]any, len(cabecalhosFuncionarios))
	for i, c := range cabecalhosFuncionarios {
		cab[i] = c
	}
	f.SetSheetRow(sheet, "A1", &cab)
	estilizarCabecalho(f, sheet, 1, len(cabecalhosFuncionarios))
	for i, largura := range largurasFuncionarios {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, largura)
	}

	for i, l := range linhas {
		linha := i + 2
		f.SetSheetRow(sheet, cellRef(1, linha), &[]any{
			l.Matricula, l.Nome, l.CPF, l.Obra, l.Cargo, l.Situacao, l.Admissao, l.Telefone, l.Cidade, l.UF,
		})
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
