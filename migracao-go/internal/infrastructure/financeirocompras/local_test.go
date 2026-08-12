package financeirocompras_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/infrastructure/database"
	"siqueiracampos/servidor/internal/infrastructure/financeirocompras"
)

func TestCriarTituloCompraEhIdempotente(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "financeiro.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}

	agora := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
	chaveNF, nota := "35260800000000000000550010000000011000000010", "1"
	entrada := dominio.TituloFinanceiroCompra{ChaveOrigem: "rec-1", Numero: "CPA-2026-0001", FornecedorID: "forn-1", FornecedorNome: "Fornecedor", Descricao: "Recebimento", ValorCentavos: 12550, Emissao: agora, Vencimento: agora.AddDate(0, 1, 0), ChaveNF: &chaveNF, NotaFiscal: &nota}
	local := financeirocompras.Novo(db)
	if err = local.CriarTituloCompra(context.Background(), entrada); err != nil {
		t.Fatal(err)
	}
	if err = local.CriarTituloCompra(context.Background(), entrada); err != nil {
		t.Fatalf("retentativa: %v", err)
	}

	for tabela, esperado := range map[string]int{"financeiro_titulos": 1, "financeiro_parcelas": 1, "financeiro_outbox": 1} {
		var quantidade int
		if err = db.QueryRow("SELECT count(*) FROM " + tabela).Scan(&quantidade); err != nil {
			t.Fatal(err)
		}
		if quantidade != esperado {
			t.Fatalf("%s: obtido %d, esperado %d", tabela, quantidade, esperado)
		}
	}
	var documentos int
	if err = db.QueryRow(`SELECT count(*) FROM financeiro_documentos_fiscais WHERE direcao='ENTRADA' AND chave=?`, chaveNF).Scan(&documentos); err != nil || documentos != 1 {
		t.Fatalf("documento fiscal de entrada=%d err=%v", documentos, err)
	}
	entrada.ValorCentavos++
	if err = local.CriarTituloCompra(context.Background(), entrada); err == nil {
		t.Fatal("aceitou mesma origem com valor conflitante")
	}
}

func TestAbaterDevolucaoReduceTituloDeFormaIdempotente(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "financeiro.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}

	agora := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
	entrada := dominio.TituloFinanceiroCompra{ChaveOrigem: "rec-1", Numero: "CPA-2026-0001", FornecedorID: "forn-1", FornecedorNome: "Fornecedor", Descricao: "Recebimento", ValorCentavos: 10000, Emissao: agora, Vencimento: agora.AddDate(0, 1, 0)}
	local := financeirocompras.Novo(db)
	if err = local.CriarTituloCompra(context.Background(), entrada); err != nil {
		t.Fatal(err)
	}

	abatimento := dominio.AbatimentoDevolucao{RecebimentoID: "rec-1", DevolucaoID: "dev-1", DevolucaoNumero: "DEV-1", Motivo: "Mercadoria avariada", ValorCentavos: 4000, RegistradoPor: "Operador"}
	if err = local.AbaterDevolucao(context.Background(), abatimento); err != nil {
		t.Fatal(err)
	}
	if err = local.AbaterDevolucao(context.Background(), abatimento); err != nil {
		t.Fatalf("idempotência falhou: %v", err)
	}

	var aberto int64
	var status string
	if err = db.QueryRow(`SELECT valor_aberto_centavos,status FROM financeiro_titulos WHERE origem_id='rec-1'`).Scan(&aberto, &status); err != nil {
		t.Fatal(err)
	}
	if aberto != 6000 || status != "APROVADO" {
		t.Fatalf("aberto=%d status=%s, esperado 6000/APROVADO", aberto, status)
	}
	var outbox int
	if err = db.QueryRow(`SELECT count(*) FROM financeiro_outbox`).Scan(&outbox); err != nil {
		t.Fatal(err)
	}
	if outbox != 2 {
		t.Fatalf("outbox=%d, esperado 2 (título + abatimento)", outbox)
	}
}

func TestAbaterDevolucaoSemTituloEhNoop(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "financeiro.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	local := financeirocompras.Novo(db)
	abatimento := dominio.AbatimentoDevolucao{RecebimentoID: "rec-sem-titulo", DevolucaoID: "dev-1", ValorCentavos: 1000, RegistradoPor: "Operador"}
	if err = local.AbaterDevolucao(context.Background(), abatimento); err != nil {
		t.Fatalf("abatimento sem título deveria ser no-op: %v", err)
	}
}

func TestAbaterDevolucaoExcedeSaldoFalha(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "financeiro.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	agora := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
	local := financeirocompras.Novo(db)
	if err = local.CriarTituloCompra(context.Background(), dominio.TituloFinanceiroCompra{ChaveOrigem: "rec-1", Numero: "CPA-2026-0001", FornecedorID: "forn-1", FornecedorNome: "Fornecedor", Descricao: "Recebimento", ValorCentavos: 5000, Emissao: agora, Vencimento: agora.AddDate(0, 1, 0)}); err != nil {
		t.Fatal(err)
	}
	abatimento := dominio.AbatimentoDevolucao{RecebimentoID: "rec-1", DevolucaoID: "dev-1", ValorCentavos: 6000, RegistradoPor: "Operador"}
	if err = local.AbaterDevolucao(context.Background(), abatimento); err == nil {
		t.Fatal("aceitou abatimento maior que o saldo aberto")
	}
}
