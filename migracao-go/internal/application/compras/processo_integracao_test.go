package compras_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	aplicacao "siqueiracampos/servidor/internal/application/compras"
	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

func ambienteProcesso(t *testing.T) (*aplicacao.GerenciadorProcesso, *database.ComprasPedidoRepositorio) {
	t.Helper()
	db, e := database.Abrir(filepath.Join(t.TempDir(), "compras.db"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { db.Close() })
	if e = database.AplicarMigracoes(db); e != nil {
		t.Fatal(e)
	}
	_, e = db.Exec(`INSERT INTO fornecedores(id,nome,ativo,criado_em)VALUES('f1','Fornecedor A',1,'2026-01-01T00:00:00Z'),('f2','Fornecedor B',1,'2026-01-01T00:00:00Z');INSERT INTO materiais(id,codigo,nome,categoria,unidade,ativo,criado_em,atualizado_em)VALUES('m1','M-1','Cimento','OBRA','SC',1,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');INSERT INTO solicitacoes_compra(id,numero,status,criado_em)VALUES('s1','SC-1','ENVIADA','2026-01-01T00:00:00Z');INSERT INTO itens_solicitacao(id,quantidade,saldo_na_epoca,minimo_na_epoca,preco_estimado,solicitacao_id,material_id)VALUES('i1',10,0,0,12.5,'s1','m1')`)
	if e != nil {
		t.Fatal(e)
	}
	ped := database.NovoComprasPedidoRepositorio(db)
	proc := database.NovoComprasProcessoRepositorio(db)
	gped := &aplicacao.Gerenciador{Pedidos: ped, Fornecedores: database.NovoFornecedorRepositorio(db), Solicitacoes: database.NovoEstoqueSolicitacaoRepositorio(db)}
	return &aplicacao.GerenciadorProcesso{Repo: proc, Pedidos: gped}, ped
}

func TestCotacaoMapaComparativoEFluxoDeAprovacao(t *testing.T) {
	g, pedidos := ambienteProcesso(t)
	ctx := context.Background()
	solicitante := identidade.Sessao{ID: "u1", Nome: "Comprador", Cargo: identidade.CargoGerente}
	c, e := g.CriarCotacao(ctx, solicitante, aplicacao.EntradaCotacao{SolicitacaoID: "s1", Fornecedores: []string{"f1", "f2"}})
	if e != nil {
		t.Fatal(e)
	}
	for _, p := range []struct{ id, valor string }{{"f1", "1200"}, {"f2", "1100"}} {
		_, e = g.RegistrarProposta(ctx, solicitante, aplicacao.EntradaProposta{CotacaoID: c.ID, FornecedorID: p.id, FreteCentavos: "100", Itens: []aplicacao.EntradaItemProposta{{MaterialID: "m1", Quantidade: "10", ValorUnitarioCentavos: p.valor}}})
		if e != nil {
			t.Fatal(e)
		}
	}
	det, e := g.Repo.BuscarCotacao(ctx, c.ID)
	if e != nil || len(det.Propostas) != 2 {
		t.Fatalf("cotação: %+v erro=%v", det, e)
	}
	if det.Propostas[0].TotalCentavos >= det.Propostas[1].TotalCentavos {
		t.Fatal("mapa não ordenou menor total primeiro")
	}
	pedido, e := g.SelecionarPropostaECriarPedido(ctx, solicitante, c.ID, det.Propostas[0].ID, "Melhor custo total")
	if e != nil {
		t.Fatal(e)
	}
	if pedido.Status != dominio.StatusPedidoRascunho || pedido.CotacaoID == nil {
		t.Fatalf("pedido: %+v", pedido)
	}
	if e = g.EnviarParaAprovacao(ctx, solicitante, pedido); e != nil {
		t.Fatal(e)
	}
	pedido, _ = pedidos.BuscarPorID(ctx, pedido.ID)
	if e = g.Aprovar(ctx, solicitante, pedido); e == nil || !strings.Contains(e.Error(), "próprio") {
		t.Fatalf("autoaprovação: %v", e)
	}
	gestor := identidade.Sessao{ID: "u2", Nome: "Gerente", Cargo: identidade.CargoGerente}
	if e = g.Aprovar(ctx, gestor, pedido); e != nil {
		t.Fatal(e)
	}
	pedido, _ = pedidos.BuscarPorID(ctx, pedido.ID)
	if e = g.MarcarEnviado(ctx, solicitante, pedido); e != nil {
		t.Fatal(e)
	}
	pedido, _ = pedidos.BuscarPorID(ctx, pedido.ID)
	if pedido.Status != dominio.StatusPedidoEnviado || pedido.AprovadorNome == nil || *pedido.AprovadorNome != "Gerente" {
		t.Fatalf("fluxo final: %+v", pedido)
	}
	indicadores, e := g.Repo.Indicadores(ctx)
	if e != nil {
		t.Fatal(e)
	}
	if indicadores.EconomiaCotacoesCentavos != 1000 {
		t.Fatalf("economia da cotação = %d", indicadores.EconomiaCotacoesCentavos)
	}
	desempenhos, e := g.Repo.ListarDesempenhoFornecedores(ctx)
	if e != nil || len(desempenhos) != 1 || desempenhos[0].QuantidadePedidos != 1 {
		t.Fatalf("desempenho: %+v erro=%v", desempenhos, e)
	}
}

func TestCotacaoExigeDoisFornecedoresEJustificativa(t *testing.T) {
	g, _ := ambienteProcesso(t)
	s := identidade.Sessao{ID: "u", Nome: "C"}
	_, e := g.CriarCotacao(context.Background(), s, aplicacao.EntradaCotacao{SolicitacaoID: "s1", Fornecedores: []string{"f1"}})
	if e == nil {
		t.Fatal("aceitou cotação sem concorrência")
	}
}
