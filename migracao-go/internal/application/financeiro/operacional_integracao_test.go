package financeiro_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/financeiro"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

func ambienteOperacional(t *testing.T) (*database.FinanceiroRepositorio, *aplicacao.GerenciadorOperacional, *aplicacao.GerenciadorBaixas) {
	t.Helper()
	db, err := database.Abrir(filepath.Join(t.TempDir(), "operacional.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	repo := database.NovoFinanceiroRepositorio(db)
	return repo, &aplicacao.GerenciadorOperacional{Repo: repo}, &aplicacao.GerenciadorBaixas{Repo: repo}
}

func TestFluxoOperacionalFinanceiroCompleto(t *testing.T) {
	repo, g, baixas := ambienteOperacional(t)
	ctx := context.Background()
	admin := identidade.Sessao{ID: "admin", Nome: "Administrador", Cargo: identidade.CargoAdmin}
	operador := identidade.Sessao{ID: "op", Nome: "Operador", Cargo: identidade.CargoOperacional}
	gerente := identidade.Sessao{ID: "ger", Nome: "Gerente", Cargo: identidade.CargoGerente}
	if err := g.CriarConta(ctx, admin, "Banco principal", "BANCO"); err != nil {
		t.Fatal(err)
	}
	contas, _ := repo.ListarContas(ctx)

	titulo, err := g.CriarTitulo(ctx, operador, aplicacao.EntradaTitulo{Tipo: "PAGAR", ContraparteNome: "Prestador", Descricao: "Serviço", Emissao: "2026-08-11", Vencimento: "2026-08-20", Valor: "150,00"})
	if err != nil {
		t.Fatal(err)
	}
	if err = g.AprovarTitulo(ctx, operador, titulo.ID); err == nil {
		t.Fatal("operador aprovou título")
	}
	if err = g.AprovarTitulo(ctx, gerente, titulo.ID); err != nil {
		t.Fatal(err)
	}
	resultado, err := baixas.Registrar(ctx, aplicacao.EntradaBaixa{TituloID: titulo.ID, ContaID: contas[0].ID, ValorCentavos: "15000", OcorridoEm: "2026-08-12", ChaveIdempotencia: "baixa-1", RegistradoPor: operador.Nome})
	if err != nil || resultado.Status != dominio.TituloLiquidado {
		t.Fatalf("baixa: %+v err=%v", resultado, err)
	}

	fat, err := g.CriarFaturamento(ctx, operador, aplicacao.EntradaFaturamento{ClienteNome: "Cliente A", Descricao: "Venda", TipoOperacao: "PRODUTO", Emissao: "2026-08-11", Vencimento: "2026-09-10", ValorBruto: "1.000,00", Desconto: "50,00", Acrescimo: "10,00", ModeloFiscal: "NFE", EmissorFiscal: "SEFAZ", ChaveIdempotencia: "fat-1"})
	if err != nil {
		t.Fatal(err)
	}
	if err = g.Faturar(ctx, operador, fat.ID); err != nil {
		t.Fatal(err)
	}
	repetido, err := g.CriarFaturamento(ctx, operador, aplicacao.EntradaFaturamento{ClienteNome: "Cliente A", Descricao: "Venda", TipoOperacao: "PRODUTO", Emissao: "2026-08-11", Vencimento: "2026-09-10", ValorBruto: "1.000,00", Desconto: "50,00", Acrescimo: "10,00", ModeloFiscal: "NFE", EmissorFiscal: "SEFAZ", ChaveIdempotencia: "fat-1"})
	if err != nil || repetido.ID != fat.ID {
		t.Fatalf("retentativa do faturamento: %+v err=%v", repetido, err)
	}
	receber, err := repo.ListarTitulos(ctx, dominio.TituloReceber)
	if err != nil || len(receber) != 1 || receber[0].ValorTotal != 96000 {
		t.Fatalf("receber: %+v err=%v", receber, err)
	}
	docs, err := repo.ListarDocumentosFiscais(ctx)
	if err != nil || len(docs) != 1 || docs[0].Status != "PENDENTE" || docs[0].Emissor != "SEFAZ" {
		t.Fatalf("fiscal: %+v err=%v", docs, err)
	}
	if err = g.RegistrarResultadoFiscal(ctx, operador, docs[0].ID, "AUTORIZADO", "35260800000000000000550010000000011000000010", "135260000000001", "<nfeProc/>", ""); err != nil {
		t.Fatal(err)
	}
}

func TestImportacaoSebraeCriaFaturamentoEReceberSemDuplicar(t *testing.T) {
	repo, g, _ := ambienteOperacional(t)
	ctx := context.Background()
	s := identidade.Sessao{ID: "op", Nome: "Operador", Cargo: identidade.CargoOperacional}
	xml := `<nfeProc><NFe><infNFe Id="NFe35260800000000000000550010000000011000000010"><ide><nNF>1</nNF><serie>1</serie><dhEmi>2026-08-11T10:00:00-03:00</dhEmi></ide><dest><xNome>Cliente legado</xNome></dest><total><ICMSTot><vNF>250.50</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>35260800000000000000550010000000011000000010</chNFe><nProt>135260000000001</nProt><dhRecbto>2026-08-11T10:01:00-03:00</dhRecbto></infProt></protNFe></nfeProc>`
	if _, err := g.ImportarSebrae(ctx, s, xml, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := g.ImportarSebrae(ctx, s, xml, ""); err != nil {
		t.Fatalf("retentativa: %v", err)
	}
	docs, _ := repo.ListarDocumentosFiscais(ctx)
	fats, _ := repo.ListarFaturamentos(ctx)
	titulos, _ := repo.ListarTitulos(ctx, dominio.TituloReceber)
	if len(docs) != 1 || len(fats) != 1 || len(titulos) != 1 || docs[0].Status != "AUTORIZADO" || titulos[0].ValorTotal != 25050 {
		t.Fatalf("docs=%d fats=%d titulos=%+v", len(docs), len(fats), titulos)
	}
	resumo, err := repo.Resumo(ctx, time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC))
	if err != nil || resumo.FaturadoMes != 25050 {
		t.Fatalf("resumo=%+v err=%v", resumo, err)
	}
}
