package financeiro_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/financeiro"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

func TestEstornoReabreLivroSemApagarFato(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "estorno.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	agora := time.Now().UTC()
	_, err = db.Exec(`INSERT INTO financeiro_titulos(id,numero,tipo,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,valor_aberto_centavos,status,criado_em,atualizado_em) VALUES('t-est','FIN-EST','PAGAR','Fornecedor','Serviço',?,?,10000,10000,'APROVADO',?,?)`, agora.Format(time.DateOnly), agora.Format("2006-01"), agora.Format(time.RFC3339), agora.Format(time.RFC3339))
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO financeiro_contas(id,nome,tipo,moeda,ativo,criado_em,atualizado_em) VALUES('c-est','Banco','BANCO','BRL',1,?,?); INSERT INTO financeiro_parcelas(id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status) VALUES('p-est','t-est',1,?,10000,10000,'ABERTA')`, agora.Format(time.RFC3339), agora.Format(time.RFC3339), agora.AddDate(0, 0, 10).Format(time.DateOnly))
	if err != nil {
		t.Fatal(err)
	}
	repo := database.NovoFinanceiroRepositorio(db)
	g := &aplicacao.GerenciadorBaixas{Repo: repo}
	ctx := context.Background()
	baixa, err := g.Registrar(ctx, aplicacao.EntradaBaixa{TituloID: "t-est", ParcelaID: "p-est", ContaID: "c-est", ValorCentavos: "3500", OcorridoEm: agora.Format(time.DateOnly), ChaveIdempotencia: "baixa-estorno", RegistradoPor: "Tesouraria"})
	if err != nil || baixa.Status != dominio.TituloParcial {
		t.Fatalf("baixa=%+v err=%v", baixa, err)
	}
	var movimentoID string
	if err := db.QueryRow(`SELECT id FROM financeiro_movimentos WHERE chave_idempotencia='baixa-estorno'`).Scan(&movimentoID); err != nil {
		t.Fatal(err)
	}
	estorno, err := g.Estornar(ctx, aplicacao.EntradaEstorno{MovimentoID: movimentoID, ChaveIdempotencia: "estorno-1", RegistradoPor: "Diretoria"})
	if err != nil || estorno.Status != dominio.TituloAprovado {
		t.Fatalf("estorno=%+v err=%v", estorno, err)
	}
	repetido, err := g.Estornar(ctx, aplicacao.EntradaEstorno{MovimentoID: movimentoID, ChaveIdempotencia: "estorno-1", RegistradoPor: "Diretoria"})
	if err != nil || !repetido.Duplicada {
		t.Fatalf("estorno não idempotente: %+v err=%v", repetido, err)
	}
	var aberto, movimentos, estornos int
	if err := db.QueryRow(`SELECT valor_aberto_centavos FROM financeiro_titulos WHERE id='t-est'`).Scan(&aberto); err != nil {
		t.Fatal(err)
	}
	_ = db.QueryRow(`SELECT count(*) FROM financeiro_movimentos WHERE titulo_id='t-est'`).Scan(&movimentos)
	_ = db.QueryRow(`SELECT count(*) FROM financeiro_movimentos WHERE movimento_original_id=?`, movimentoID).Scan(&estornos)
	if aberto != 10000 || movimentos != 2 || estornos != 1 {
		t.Fatalf("livro inconsistente: aberto=%d movimentos=%d estornos=%d", aberto, movimentos, estornos)
	}
}

func TestFechamentoBloqueiaCompetenciaEPermiteReaberturaAuditada(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "fechamento.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	repo := database.NovoFinanceiroRepositorio(db)
	ctx := context.Background()
	competencia := time.Now().UTC().Format("2006-01")
	if err := repo.FecharCompetencia(ctx, competencia, "admin", "Admin"); err != nil {
		t.Fatal(err)
	}
	g := &aplicacao.GerenciadorOperacional{Repo: repo}
	data := competencia + "-01"
	_, err = g.CriarTitulo(ctx, identidade.Sessao{ID: "op", Nome: "Operador", Cargo: identidade.CargoOperacional}, aplicacao.EntradaTitulo{Tipo: "PAGAR", ContraparteNome: "Fornecedor", Descricao: "Bloqueado", Emissao: data, Vencimento: data, Valor: "10,00"})
	if !errors.Is(err, dominio.ErrCompetenciaFechada) {
		t.Fatalf("criação em competência fechada: %v", err)
	}
	if err := repo.ReabrirCompetencia(ctx, competencia, "admin", "Admin", "Ajuste conferido"); err != nil {
		t.Fatal(err)
	}
	titulo, err := g.CriarTitulo(ctx, identidade.Sessao{ID: "op", Nome: "Operador", Cargo: identidade.CargoOperacional}, aplicacao.EntradaTitulo{Tipo: "PAGAR", ContraparteNome: "Fornecedor", Descricao: "Liberado", Emissao: data, Vencimento: data, Valor: "10,00"})
	if err != nil || titulo == nil {
		t.Fatalf("criação após reabertura: %v", err)
	}
	var auditorias int
	if err := db.QueryRow(`SELECT count(*) FROM financeiro_auditoria WHERE agregado_tipo='FECHAMENTO' AND agregado_id=?`, competencia).Scan(&auditorias); err != nil {
		t.Fatal(err)
	}
	if auditorias != 2 {
		t.Fatalf("auditoria de fechamento incompleta: %d", auditorias)
	}
}
