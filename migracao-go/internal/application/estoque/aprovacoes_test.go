package estoque

import (
	"context"
	"testing"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

func novoGerenciadorAprovacoes() (*GerenciadorAprovacoes, *materiaisFake, *movimentacoesFake, *aprovacoesFake) {
	mat := novoMateriaisFake()
	mov := &movimentacoesFake{}
	apr := novoAprovacoesFake()
	g := &GerenciadorAprovacoes{Aprovacoes: apr, Materiais: mat, Movimentacoes: mov}
	return g, mat, mov, apr
}

func pedidoDePerdaPendente(apr *aprovacoesFake, solicitanteID string) *dominio.Aprovacao {
	a := &dominio.Aprovacao{
		Tipo: dominio.AprovacaoPerda, Dados: `{"materialId":"m1","quantidade":2,"ocorridoEm":"2026-01-15T00:00:00Z"}`,
		SolicitanteID: solicitanteID, SolicitanteNome: "Solicitante",
	}
	_ = apr.Criar(context.Background(), a)
	return a
}

// TestAprovar_BloqueiaAutoAprovacao é a regra central da fila de aprovação (aprovacoes.go:44-48
// e :177-179): quem pediu não pode ser quem decide, mesmo tendo cargo de aprovador — sem isso
// a segregação de função que justifica a fila inteira deixa de existir.
func TestAprovar_BloqueiaAutoAprovacao(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "u1")

	_, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoGerente}, pedido.ID)
	if err == nil {
		t.Fatal("esperava erro: mesma pessoa que pediu não pode aprovar, mesmo sendo GERENTE")
	}
}

func TestRejeitar_BloqueiaAutoRejeicao(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "u1")

	err := g.Rejeitar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoGerente}, pedido.ID, "motivo qualquer")
	if err == nil {
		t.Fatal("esperava erro: mesma pessoa que pediu não pode decidir o próprio pedido")
	}
}

func TestAprovar_ExigeCargoDeAprovador(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	_, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, pedido.ID)
	if err == nil {
		t.Fatal("OPERACIONAL não pode aprovar, mesmo não sendo o solicitante")
	}
}

func TestAprovar_Perda_GravaMovimentacaoEMarcaAprovada(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	res, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u2", Nome: "Gerente", Cargo: identidade.CargoGerente}, pedido.ID)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.ReferenciaID == nil {
		t.Fatal("esperava referência à movimentação criada")
	}
	if len(mov.criadas) != 1 || mov.criadas[0].Tipo != dominio.MovPerda {
		t.Fatalf("esperava movimentação de perda gravada, veio %+v", mov.criadas)
	}
	if apr.porID[pedido.ID].Status != dominio.AprovacaoAprovada {
		t.Fatalf("esperava status APROVADA, veio %q", apr.porID[pedido.ID].Status)
	}
}

// TestAprovar_RevalidaSaldoNoMomentoDaDecisao prova que Aprovar confere o saldo DE NOVO
// (aprovacoes.go §4) — o mundo pode ter mudado entre o pedido e a aprovação.
func TestAprovar_RevalidaSaldoNoMomentoDaDecisao(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 1) // saldo caiu pra 1 desde o pedido
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")                     // pedido original pedia baixa de 2

	_, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u2", Cargo: identidade.CargoGerente}, pedido.ID)
	if err == nil {
		t.Fatal("esperava recusa: saldo atual (1) é menor que a baixa pedida (2)")
	}
	if len(mov.criadas) != 0 {
		t.Fatal("nenhuma movimentação deveria ter sido criada quando a revalidação falha")
	}
}

func TestAprovar_MaterialInativoDesdeOPedido_Recusado(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, false), 10) // inativado depois do pedido
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	_, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u2", Cargo: identidade.CargoGerente}, pedido.ID)
	if err == nil {
		t.Fatal("esperava recusa: material foi inativado depois do pedido")
	}
}

func TestAprovar_PedidoJaDecidido_Recusado(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	if _, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u2", Cargo: identidade.CargoGerente}, pedido.ID); err != nil {
		t.Fatal(err)
	}
	// Segunda decisão sobre o MESMO pedido, já aprovado — tem que recusar.
	_, err := g.Aprovar(context.Background(), identidade.Sessao{ID: "u3", Cargo: identidade.CargoGerente}, pedido.ID)
	if err == nil {
		t.Fatal("esperava recusa: pedido já foi decidido")
	}
}

func TestRejeitar_ExigeMotivo(t *testing.T) {
	g, mat, _, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	err := g.Rejeitar(context.Background(), identidade.Sessao{ID: "u2", Cargo: identidade.CargoGerente}, pedido.ID, "ok")
	if err == nil {
		t.Fatal("motivo com menos de 3 caracteres deveria ser recusado")
	}
}

func TestRejeitar_CaminhoFeliz(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorAprovacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)
	pedido := pedidoDePerdaPendente(apr, "outra-pessoa")

	err := g.Rejeitar(context.Background(), identidade.Sessao{ID: "u2", Nome: "Gerente", Cargo: identidade.CargoGerente}, pedido.ID, "não faz sentido")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if apr.porID[pedido.ID].Status != dominio.AprovacaoRejeitada {
		t.Fatalf("esperava status REJEITADA, veio %q", apr.porID[pedido.ID].Status)
	}
	if len(mov.criadas) != 0 {
		t.Fatal("rejeição não pode gerar movimentação nenhuma")
	}
}
