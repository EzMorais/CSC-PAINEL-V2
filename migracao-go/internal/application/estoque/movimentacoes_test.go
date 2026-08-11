package estoque

import (
	"context"
	"testing"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

func materialTeste(id string, categoria dominio.Categoria, ativo bool) *dominio.Material {
	return &dominio.Material{ID: id, Codigo: "MAT-" + id, Nome: "Material " + id, Categoria: categoria, Unidade: "UN", Ativo: ativo}
}

func novoGerenciadorMovimentacoes() (*GerenciadorMovimentacoes, *materiaisFake, *movimentacoesFake, *aprovacoesFake) {
	mat := novoMateriaisFake()
	mov := &movimentacoesFake{}
	apr := novoAprovacoesFake()
	g := &GerenciadorMovimentacoes{
		Materiais: mat, Movimentacoes: mov, Aprovacoes: apr,
		Configuracao: &configuracaoFake{}, ClienteRH: &clienteRHFake{},
	}
	return g, mat, mov, apr
}

const dataTeste = "2026-01-15"

func TestRegistrar_SaidaNormal_Sucesso(t *testing.T) {
	g, mat, mov, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	res, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: string(dominio.MovSaida), Quantidade: "3", ObraID: "obra1", OcorridoEm: dataTeste,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.PendenteAprovacao {
		t.Fatal("saída normal de ferramenta não deveria precisar de aprovação")
	}
	if len(mov.criadas) != 1 || mov.criadas[0].Quantidade != 3 || mov.criadas[0].Tipo != dominio.MovSaida {
		t.Fatalf("movimentação não gravada como esperado: %+v", mov.criadas)
	}
}

// TestRegistrar_SaidaComSaldoInsuficiente_Recusada prova o bloqueio de saldo negativo
// (movimentacoes.go:96-108) — uma saída maior que o saldo disponível não pode existir no
// livro-razão: não há como o mundo físico ter menos que zero de um material.
func TestRegistrar_SaidaComSaldoInsuficiente_Recusada(t *testing.T) {
	g, mat, mov, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 5)

	_, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: string(dominio.MovSaida), Quantidade: "10", ObraID: "obra1", OcorridoEm: dataTeste,
	})
	if err == nil {
		t.Fatal("esperava erro de saldo insuficiente")
	}
	if len(mov.criadas) != 0 {
		t.Fatal("nenhuma movimentação deveria ter sido gravada quando o saldo é insuficiente")
	}
}

func TestRegistrar_MaterialInativo_Recusada(t *testing.T) {
	g, mat, _, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, false), 10)

	_, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: string(dominio.MovEntrada), Quantidade: "5", OcorridoEm: dataTeste,
	})
	if err == nil {
		t.Fatal("esperava erro para material inativo")
	}
}

func TestRegistrar_TipoInvalido_Recusada(t *testing.T) {
	g, mat, _, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	_, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: "TIPO_QUE_NAO_EXISTE", Quantidade: "5", OcorridoEm: dataTeste,
	})
	if err == nil {
		t.Fatal("esperava erro para tipo de movimentação inválido")
	}
}

// TestRegistrar_SaidaDeEPISemFuncionario_Recusada prova a exigência de funcionário pra saída
// de EPI (ExigeFuncionario) — a NR-6 obriga provar a quem foi entregue cada equipamento.
func TestRegistrar_SaidaDeEPISemFuncionario_Recusada(t *testing.T) {
	g, mat, _, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("epi1", dominio.CategoriaEPI, true), 10)

	_, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "epi1", Tipo: string(dominio.MovSaida), Quantidade: "1", OcorridoEm: dataTeste,
	})
	if err == nil {
		t.Fatal("esperava erro: saída de EPI sem funcionário")
	}
}

func TestRegistrar_SaidaDeEPIComFuncionario_SincronizaFicha(t *testing.T) {
	g, mat, mov, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("epi1", dominio.CategoriaEPI, true), 10)
	cliente := g.ClienteRH.(*clienteRHFake)

	res, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "epi1", Tipo: string(dominio.MovSaida), Quantidade: "1", FuncionarioID: "f1", FuncionarioNome: "Zé", OcorridoEm: dataTeste,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.ID == "" {
		t.Fatal("esperava ID da movimentação criada")
	}
	if len(mov.criadas) != 1 || mov.criadas[0].FuncionarioID == nil || *mov.criadas[0].FuncionarioID != "f1" {
		t.Fatalf("movimentação não gravou o funcionário: %+v", mov.criadas)
	}
	if !cliente.chamado {
		t.Error("esperava que a ficha de EPI fosse sincronizada com o RH")
	}
}

// TestRegistrar_PerdaPorQuemNaoAprova_VaiParaFilaDeAprovacao prova que PERDA sempre passa
// pela fila quando quem lança não pode aprovar (aprovacoes.go / movimentacoes.go:110-130) —
// não existe limite de valor abaixo do qual perda dispensa segundo olhar.
func TestRegistrar_PerdaPorQuemNaoAprova_VaiParaFilaDeAprovacao(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	res, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoOperacional}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: string(dominio.MovPerda), Quantidade: "2", OcorridoEm: dataTeste,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !res.PendenteAprovacao {
		t.Fatal("perda lançada por OPERACIONAL deveria ficar pendente de aprovação")
	}
	if len(mov.criadas) != 0 {
		t.Fatal("nenhuma movimentação deveria existir ainda — só o pedido de aprovação")
	}
	if len(apr.criadas) != 1 || apr.criadas[0].Tipo != dominio.AprovacaoPerda {
		t.Fatalf("esperava 1 pedido de aprovação do tipo PERDA, veio %+v", apr.criadas)
	}
}

func TestRegistrar_PerdaPorQuemJaAprova_GravaDireto(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	res, err := g.Registrar(context.Background(), identidade.Sessao{ID: "u1", Nome: "Gerente", Cargo: identidade.CargoGerente}, EntradaMovimentacao{
		MaterialID: "m1", Tipo: string(dominio.MovPerda), Quantidade: "2", OcorridoEm: dataTeste,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.PendenteAprovacao {
		t.Fatal("GERENTE já pode aprovar — a própria perda não deveria entrar na fila")
	}
	if len(mov.criadas) != 1 {
		t.Fatalf("esperava a movimentação de perda gravada direto, veio %+v", mov.criadas)
	}
	if len(apr.criadas) != 0 {
		t.Fatal("não deveria ter criado pedido de aprovação nenhum")
	}
}

func TestAjustarPorInventario_DentroDoLimite_GravaDireto(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	// Limite padrão de ajuste é 10 (obterLimites, sem configuração salva) — diferença de 3
	// fica dentro, não deveria acionar aprovação.
	res, err := g.AjustarPorInventario(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoOperacional}, EntradaAjuste{
		MaterialID: "m1", QuantidadeContada: "13",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.PendenteAprovacao {
		t.Fatal("ajuste dentro do limite não deveria pedir aprovação")
	}
	if len(mov.criadas) != 1 || mov.criadas[0].Tipo != dominio.MovAjustePositivo {
		t.Fatalf("esperava ajuste positivo gravado, veio %+v", mov.criadas)
	}
	if len(apr.criadas) != 0 {
		t.Fatal("não deveria ter ido para fila de aprovação")
	}
}

func TestAjustarPorInventario_AcimaDoLimitePorQuemNaoAprova_VaiParaFila(t *testing.T) {
	g, mat, mov, apr := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	res, err := g.AjustarPorInventario(context.Background(), identidade.Sessao{ID: "u1", Nome: "Ana", Cargo: identidade.CargoOperacional}, EntradaAjuste{
		MaterialID: "m1", QuantidadeContada: "50", // diferença de 40, acima do limite padrão (10)
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !res.PendenteAprovacao {
		t.Fatal("ajuste acima do limite, lançado por quem não aprova, deveria pedir aprovação")
	}
	if len(mov.criadas) != 0 {
		t.Fatal("nenhuma movimentação deveria existir ainda")
	}
	if len(apr.criadas) != 1 || apr.criadas[0].Tipo != dominio.AprovacaoAjusteInventario {
		t.Fatalf("esperava 1 pedido de aprovação de ajuste, veio %+v", apr.criadas)
	}
}

func TestAjustarPorInventario_SemDiferenca_Recusado(t *testing.T) {
	g, mat, _, _ := novoGerenciadorMovimentacoes()
	mat.adicionar(materialTeste("m1", dominio.CategoriaFerramenta, true), 10)

	_, err := g.AjustarPorInventario(context.Background(), identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}, EntradaAjuste{
		MaterialID: "m1", QuantidadeContada: "10",
	})
	if err == nil {
		t.Fatal("contagem igual ao saldo não deveria gerar ajuste nenhum")
	}
}
