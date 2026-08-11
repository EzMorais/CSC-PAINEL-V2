package rh

import (
	"context"
	"strings"
	"testing"
)

func entradaFuncionarioCompleta() EntradaFuncionario {
	return EntradaFuncionario{
		Nome: "JOÃO BATISTA SILVEIRA", CPF: "52998224725", RG: "123456789",
		DataNascimento: "1990-05-10", Telefone: "11999998888", CEP: "01001000",
		Logradouro: "Praça da Sé", Numero: "100", Bairro: "Sé", Cidade: "São Paulo", UF: "SP",
		AdmitidoEm: "2026-08-01", Status: "ATIVO", TipoContrato: "CLT", CargoID: "cargo-1",
		DepartamentoID: "setor-1", Salario: "2500.00",
	}
}

func TestValidarFuncionarioExigeCadastroEssencial(t *testing.T) {
	g := &GerenciadorFuncionarios{}
	e := entradaFuncionarioCompleta()
	e.RG, e.Telefone, e.CEP, e.CargoID, e.DepartamentoID, e.Salario = "", "", "", "", "", ""
	_, erros := g.validar(context.Background(), e)
	juntos := strings.Join(erros, " ")
	for _, esperado := range []string{"RG", "telefone", "CEP", "cargo", "departamento", "salário"} {
		if !strings.Contains(strings.ToLower(juntos), strings.ToLower(esperado)) {
			t.Errorf("erro de %s não retornado: %s", esperado, juntos)
		}
	}
}

func TestValidarFuncionarioAceitaCadastroCompleto(t *testing.T) {
	g := &GerenciadorFuncionarios{}
	f, erros := g.validar(context.Background(), entradaFuncionarioCompleta())
	if len(erros) != 0 {
		t.Fatalf("cadastro completo recusado: %v", erros)
	}
	if f == nil || f.CargoID == nil || f.DepartamentoID == nil || f.Salario == nil {
		t.Fatalf("dados obrigatórios não foram materializados: %+v", f)
	}
}

func TestValidarFuncionarioExigeConjuntoBancarioCompleto(t *testing.T) {
	g := &GerenciadorFuncionarios{}
	e := entradaFuncionarioCompleta()
	e.Banco = "001"
	_, erros := g.validar(context.Background(), e)
	if !strings.Contains(strings.Join(erros, " "), "Preencha banco") {
		t.Fatalf("esperava erro de conjunto bancário, vieram %v", erros)
	}
}
