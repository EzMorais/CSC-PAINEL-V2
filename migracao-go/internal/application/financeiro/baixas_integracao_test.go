package financeiro_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	aplicacao "siqueiracampos/servidor/internal/application/financeiro"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

func TestBaixaSQLiteAtualizaTituloParcelaOutboxEAuditoria(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "financeiro.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO financeiro_titulos
		(id,numero,tipo,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,
		 valor_aberto_centavos,status,criado_em,atualizado_em)
		VALUES('t1','FIN-0001','PAGAR','Fornecedor','Serviço','2026-08-01','2026-08',10000,10000,
		'APROVADO','2026-08-01T00:00:00Z','2026-08-01T00:00:00Z');
		INSERT INTO financeiro_contas(id,nome,tipo,moeda,ativo,criado_em,atualizado_em)
		VALUES('c1','Conta corrente','BANCO','BRL',1,'2026-08-01T00:00:00Z','2026-08-01T00:00:00Z');
		INSERT INTO financeiro_parcelas(id,titulo_id,numero,vencimento,valor_original_centavos,
		 valor_aberto_centavos,status) VALUES('p1','t1',1,'2026-08-20',10000,10000,'ABERTA')`)
	if err != nil {
		t.Fatal(err)
	}

	g := &aplicacao.GerenciadorBaixas{Repo: database.NovoFinanceiroRepositorio(db)}
	e := aplicacao.EntradaBaixa{TituloID: "t1", ParcelaID: "p1", ContaID: "c1", ValorCentavos: "3500", OcorridoEm: "2026-08-11", ChaveIdempotencia: "banco-abc", RegistradoPor: "Tesouraria"}
	res, err := g.Registrar(context.Background(), e)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != dominio.TituloParcial {
		t.Fatalf("status = %s", res.Status)
	}
	// Reentrega da mesma confirmação bancária precisa ser inofensiva.
	res, err = g.Registrar(context.Background(), e)
	if err != nil || !res.Duplicada {
		t.Fatalf("reentrega: resultado=%+v erro=%v", res, err)
	}
	conflitante := e
	conflitante.ValorCentavos = "3000"
	if _, err = g.Registrar(context.Background(), conflitante); !errors.Is(err, dominio.ErrChaveConflitante) {
		t.Fatalf("chave conflitante: %v", err)
	}

	var abertoTitulo, abertoParcela, movimentos, eventos, auditorias int
	if err := db.QueryRow(`SELECT valor_aberto_centavos FROM financeiro_titulos WHERE id='t1'`).Scan(&abertoTitulo); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT valor_aberto_centavos FROM financeiro_parcelas WHERE id='p1'`).Scan(&abertoParcela); err != nil {
		t.Fatal(err)
	}
	db.QueryRow(`SELECT count(*) FROM financeiro_movimentos WHERE titulo_id='t1'`).Scan(&movimentos)
	db.QueryRow(`SELECT count(*) FROM financeiro_outbox WHERE agregado_id='t1'`).Scan(&eventos)
	db.QueryRow(`SELECT count(*) FROM financeiro_auditoria WHERE agregado_id='t1'`).Scan(&auditorias)
	if abertoTitulo != 6500 || abertoParcela != 6500 || movimentos != 1 || eventos != 1 || auditorias != 1 {
		t.Fatalf("titulo=%d parcela=%d movimentos=%d eventos=%d auditorias=%d", abertoTitulo, abertoParcela, movimentos, eventos, auditorias)
	}
	if _, err = db.Exec(`UPDATE financeiro_movimentos SET valor_centavos=1 WHERE titulo_id='t1'`); err == nil {
		t.Fatal("livro financeiro permitiu alterar movimento")
	}
	if _, err = db.Exec(`DELETE FROM financeiro_auditoria WHERE agregado_id='t1'`); err == nil {
		t.Fatal("trilha de auditoria permitiu exclusão")
	}
}
