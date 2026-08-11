package alojamentos_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/alojamentos"
	dominio "siqueiracampos/servidor/internal/domain/alojamentos"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

func ambiente(t *testing.T) (*aplicacao.Gerenciador, dominio.Repositorio) {
	t.Helper()
	db, err := database.Abrir(filepath.Join(t.TempDir(), "teste.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO funcionarios(id,matricula,nome,cpf,status,admitido_em,tipo_contrato,criado_em) VALUES
	 ('f1','SC-0001','Ana','11111111111','ATIVO','2026-01-01','CLT','2026-01-01T00:00:00Z'),
	 ('f2','SC-0002','Bia','22222222222','ATIVO','2026-01-01','CLT','2026-01-01T00:00:00Z')`)
	if err != nil {
		t.Fatal(err)
	}
	repo := database.NovoAlojamentosRepositorio(db)
	return &aplicacao.Gerenciador{Repo: repo}, repo
}

func TestUmaCamaEUmaAlocacaoAtivaPorPessoa(t *testing.T) {
	g, repo := ambiente(t)
	ctx := context.Background()
	a, err := g.SalvarAlojamento(ctx, "", aplicacao.EntradaAlojamento{Nome: "Casa Centro"})
	if err != nil {
		t.Fatal(err)
	}
	if err := g.CriarQuarto(ctx, aplicacao.EntradaQuarto{AlojamentoID: a.ID, Numero: "1", Capacidade: "1"}); err != nil {
		t.Fatal(err)
	}
	detalhe, _ := repo.BuscarAlojamento(ctx, a.ID)
	q := detalhe.Quartos[0]
	base := aplicacao.EntradaAlocacao{FuncionarioID: "f1", FuncionarioNome: "Ana", Matricula: "SC-0001", AlojamentoID: a.ID, QuartoID: q.ID, DataEntrada: "2026-08-01"}
	if err := g.CriarAlocacao(ctx, base, "Gestor"); err != nil {
		t.Fatal(err)
	}
	base.FuncionarioID = "f2"
	base.FuncionarioNome = "Bia"
	base.Matricula = "SC-0002"
	if err := g.CriarAlocacao(ctx, base, "Gestor"); err == nil || !strings.Contains(err.Error(), "lotado") {
		t.Fatalf("esperava quarto lotado, recebeu %v", err)
	}
	base.QuartoID = ""
	base.FuncionarioID = "f1"
	base.FuncionarioNome = "Ana"
	if err := g.CriarAlocacao(ctx, base, "Gestor"); err == nil || !strings.Contains(err.Error(), "já está alocado") {
		t.Fatalf("esperava alocação duplicada, recebeu %v", err)
	}
}

func TestEncerramentoPreservaHistoricoELiberaCama(t *testing.T) {
	g, repo := ambiente(t)
	ctx := context.Background()
	a, _ := g.SalvarAlojamento(ctx, "", aplicacao.EntradaAlojamento{Nome: "Casa Norte"})
	g.CriarQuarto(ctx, aplicacao.EntradaQuarto{AlojamentoID: a.ID, Numero: "A", Capacidade: "1"})
	d, _ := repo.BuscarAlojamento(ctx, a.ID)
	g.CriarAlocacao(ctx, aplicacao.EntradaAlocacao{FuncionarioID: "f1", FuncionarioNome: "Ana", Matricula: "SC-0001", AlojamentoID: a.ID, QuartoID: d.Quartos[0].ID, DataEntrada: "2026-08-01"}, "Gestor")
	xs, _ := repo.ListarAlocacoes(ctx, "")
	if err := g.Encerrar(ctx, xs[0].ID, "2026-07-31", ""); err == nil {
		t.Fatal("aceitou saída anterior à entrada")
	}
	if err := g.Encerrar(ctx, xs[0].ID, "2026-08-10", "Transferência"); err != nil {
		t.Fatal(err)
	}
	if err := g.CriarAlocacao(ctx, aplicacao.EntradaAlocacao{FuncionarioID: "f2", FuncionarioNome: "Bia", Matricula: "SC-0002", AlojamentoID: a.ID, QuartoID: d.Quartos[0].ID, DataEntrada: "2026-08-11"}, "Gestor"); err != nil {
		t.Fatal(err)
	}
	xs, _ = repo.ListarAlocacoes(ctx, "")
	if len(xs) != 2 || xs[1].Status != dominio.AlocacaoEncerrada {
		t.Fatalf("histórico inesperado: %+v", xs)
	}
}

func TestPedidoEProgramacao(t *testing.T) {
	g, repo := ambiente(t)
	ctx := context.Background()
	a, _ := g.SalvarAlojamento(ctx, "", aplicacao.EntradaAlojamento{Nome: "Casa Sul"})
	if err := g.CriarPedido(ctx, aplicacao.EntradaPedido{AlojamentoID: a.ID, Tipo: "MANUTENCAO", Titulo: "Trocar torneira"}, "Gestor"); err != nil {
		t.Fatal(err)
	}
	ps, _ := repo.ListarPedidos(ctx, "")
	if err := g.AtualizarPedido(ctx, ps[0].ID, dominio.PedidoAtendido, "Resolvido", "Gestor"); err != nil {
		t.Fatal(err)
	}
	ps, _ = repo.ListarPedidos(ctx, "")
	if ps[0].Status != dominio.PedidoAtendido || ps[0].AtendidoEm == nil {
		t.Fatalf("pedido: %+v", ps[0])
	}
	if err := g.CriarProgramacao(ctx, aplicacao.EntradaProgramacao{Data: "2026-08-15", Tipo: "AVISO", Titulo: "Sem expediente"}, "Gestor"); err != nil {
		t.Fatal(err)
	}
	itens, _ := repo.ListarProgramacao(ctx, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 31, 0, 0, 0, 0, time.UTC))
	if len(itens) != 1 || itens[0].AlojamentoID != nil {
		t.Fatalf("programação geral: %+v", itens)
	}
}
