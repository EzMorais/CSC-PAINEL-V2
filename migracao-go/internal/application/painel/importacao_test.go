package painel

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"

	"siqueiracampos/servidor/internal/domain/cadastro"
)

// planilhaTeste monta, num arquivo real em disco (t.TempDir()), uma planilha no formato que
// internal/infrastructure/planilha/parser.go espera — ver COMPORTAMENTO.md §6.3: cabeçalho
// "Nº" na coluna 1, descrição na 2, Tr na 3, datas nas colunas 4/5 (seriais reais do Excel,
// não texto — o parser do Painel só lê o valor bruto), valor na 12, fornecedor na 14.
func planilhaTeste(t *testing.T, nomeAba string, linhas []linhaTeste) string {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", nomeAba)

	_ = f.SetCellValue(nomeAba, "A1", "Nº")
	_ = f.SetCellValue(nomeAba, "B1", "Descrição")

	for i, l := range linhas {
		linha := i + 2
		_ = f.SetCellValue(nomeAba, cel(1, linha), l.numero)
		_ = f.SetCellValue(nomeAba, cel(2, linha), l.descricao)
		_ = f.SetCellValue(nomeAba, cel(3, linha), l.tr)
		_ = f.SetCellValue(nomeAba, cel(4, linha), l.inicio)
		_ = f.SetCellValue(nomeAba, cel(5, linha), l.fim)
		_ = f.SetCellValue(nomeAba, cel(12, linha), l.valorItem)
		_ = f.SetCellValue(nomeAba, cel(14, linha), l.fornecedor)
	}

	caminho := filepath.Join(t.TempDir(), "planilha-teste.xlsx")
	if err := f.SaveAs(caminho); err != nil {
		t.Fatal(err)
	}
	return caminho
}

func cel(col, linha int) string {
	c, _ := excelize.CoordinatesToCellName(col, linha)
	return c
}

type linhaTeste struct {
	numero     string
	descricao  string
	tr         string
	inicio     time.Time
	fim        time.Time
	valorItem  float64
	fornecedor string
}

func novoImportador() (*Importador, *obrasFake, *fornecedoresFake, *locacoesFake) {
	obras := &obrasFake{lista: []cadastro.Obra{
		{ID: "obra-1", Cliente: "Cliente Teste", Codigo: "EX-0001-26", Descricao: "Obra Teste", AbaOrigem: "OBRA1", Ativa: true},
	}}
	fornecedores := &fornecedoresFake{}
	locacoes := &locacoesFake{}
	im := &Importador{Obras: obras, Fornecedores: fornecedores, Locacoes: locacoes}
	return im, obras, fornecedores, locacoes
}

func TestGerarPrevia_Painel_NaoGravaNada(t *testing.T) {
	im, _, _, loc := novoImportador()
	caminho := planilhaTeste(t, "OBRA1", []linhaTeste{
		{numero: "1", descricao: "Betoneira 400L", tr: "TR-0001", inicio: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), fim: time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC), valorItem: 150, fornecedor: "Fornecedor Teste"},
	})

	previa, err := im.GerarPrevia(context.Background(), caminho)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if previa.Total != 1 || previa.Ativos != 1 {
		t.Fatalf("esperava Total=1 Ativos=1, veio %+v", previa)
	}
	if len(previa.FornecedoresNovos) != 1 || previa.FornecedoresNovos[0] != "Fornecedor Teste" {
		t.Errorf("esperava fornecedor novo 'Fornecedor Teste', veio %v", previa.FornecedoresNovos)
	}
	if len(loc.criadas) != 0 {
		t.Fatal("GerarPrevia não pode gravar nenhuma locação")
	}
}

func TestConfirmarImportacao_Painel_CriaFornecedorELocacao(t *testing.T) {
	im, _, forn, loc := novoImportador()
	caminho := planilhaTeste(t, "OBRA1", []linhaTeste{
		{numero: "1", descricao: "Betoneira 400L", tr: "TR-0001", inicio: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), fim: time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC), valorItem: 150, fornecedor: "Fornecedor Teste"},
	})

	resultado, err := im.ConfirmarImportacao(context.Background(), caminho)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resultado.Criadas != 1 || resultado.FornecedoresCriados != 1 {
		t.Fatalf("resultado não confere: %+v", resultado)
	}
	if len(forn.lista) != 1 || forn.lista[0].Nome != "Fornecedor Teste" {
		t.Fatalf("fornecedor não foi criado como esperado: %+v", forn.lista)
	}
	if len(loc.criadas) != 1 || loc.criadas[0].Descricao != "Betoneira 400L" {
		t.Fatalf("locação não foi gravada como esperada: %+v", loc.criadas)
	}
}

// TestConfirmarImportacao_Painel_Idempotente prova a proteção documentada em
// COMPORTAMENTO.md §6.6: reimportar o MESMO arquivo (ex.: alguém clicou duas vezes, ou subiu
// a planilha de novo por engano) não duplica a locação — a chave de idempotência já existe.
func TestConfirmarImportacao_Painel_Idempotente(t *testing.T) {
	im, _, _, loc := novoImportador()
	caminho := planilhaTeste(t, "OBRA1", []linhaTeste{
		{numero: "1", descricao: "Betoneira 400L", tr: "TR-0001", inicio: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), fim: time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC), valorItem: 150, fornecedor: "Fornecedor Teste"},
	})

	primeiro, err := im.ConfirmarImportacao(context.Background(), caminho)
	if err != nil {
		t.Fatal(err)
	}
	if primeiro.Criadas != 1 {
		t.Fatalf("primeira importação deveria criar 1 locação, veio %d", primeiro.Criadas)
	}

	segundo, err := im.ConfirmarImportacao(context.Background(), caminho)
	if err != nil {
		t.Fatal(err)
	}
	if segundo.Criadas != 0 || segundo.Puladas != 1 {
		t.Fatalf("reimportar o mesmo arquivo deveria pular tudo (já existe), veio Criadas=%d Puladas=%d", segundo.Criadas, segundo.Puladas)
	}
	if len(loc.criadas) != 1 {
		t.Fatalf("não pode haver locação duplicada no total, veio %d", len(loc.criadas))
	}
}

func TestConfirmarImportacao_Painel_FornecedorJaCadastrado_NaoRecriaMesmoComAliasDiferente(t *testing.T) {
	im, _, forn, _ := novoImportador()
	forn.lista = append(forn.lista, cadastro.Fornecedor{ID: "forn-1", Nome: "Fornecedor Teste", Ativo: true})

	caminho := planilhaTeste(t, "OBRA1", []linhaTeste{
		{numero: "1", descricao: "Betoneira 400L", tr: "TR-0001", inicio: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), fim: time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC), valorItem: 150, fornecedor: "Fornecedor Teste"},
	})

	resultado, err := im.ConfirmarImportacao(context.Background(), caminho)
	if err != nil {
		t.Fatal(err)
	}
	if resultado.FornecedoresCriados != 0 {
		t.Fatalf("fornecedor já cadastrado não deveria ser recriado, veio FornecedoresCriados=%d", resultado.FornecedoresCriados)
	}
	if len(forn.lista) != 1 {
		t.Fatalf("esperava continuar com 1 fornecedor só, veio %d", len(forn.lista))
	}
}
