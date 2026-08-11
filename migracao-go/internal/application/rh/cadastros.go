// Package rh orquestra domínio + portas de repositório do RH e SST — ver ARQUITETURA.md §1
// e migracao-go/rh/COMPORTAMENTO.md.
package rh

import (
	"context"
	"strings"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type ErroValidacao struct{ Mensagens []string }

func (e *ErroValidacao) Error() string { return strings.Join(e.Mensagens, " ") }

func erroValidacao(msgs ...string) *ErroValidacao { return &ErroValidacao{Mensagens: msgs} }

func ponteiro(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// ---------- Cargo ----------

type GerenciadorCargos struct {
	Cargos dominio.CargoRepositorio
}

type EntradaCargo struct {
	Nome, CBO, Risco, Descricao, Responsabilidades, Requisitos, DocumentosObrigatorios string
}

// Salvar espelha o formulário de cargo em /configuracoes — COMPORTAMENTO.md §2. id vazio cria.
func (g *GerenciadorCargos) Salvar(ctx context.Context, id string, e EntradaCargo) error {
	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return erroValidacao("Informe o nome do cargo.")
	}
	risco := e.Risco
	if risco != dominio.RiscoNormal && risco != dominio.RiscoInsalubre && risco != dominio.RiscoPericuloso {
		risco = dominio.RiscoNormal
	}
	cbo := ponteiro(e.CBO)

	if id == "" {
		c := &dominio.Cargo{
			Nome: nome, CBO: cbo, Risco: risco, Descricao: ponteiro(e.Descricao),
			Responsabilidades: ponteiro(e.Responsabilidades), Requisitos: ponteiro(e.Requisitos),
			DocumentosObrigatorios: ponteiro(e.DocumentosObrigatorios),
		}
		if err := g.Cargos.Criar(ctx, c); err != nil {
			return traduzirErroCargo(err)
		}
		return nil
	}
	existente, err := g.Cargos.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if existente == nil {
		return erroValidacao("Cargo não encontrado.")
	}
	existente.Nome, existente.CBO, existente.Risco = nome, cbo, risco
	existente.Descricao = ponteiro(e.Descricao)
	existente.Responsabilidades = ponteiro(e.Responsabilidades)
	existente.Requisitos = ponteiro(e.Requisitos)
	existente.DocumentosObrigatorios = ponteiro(e.DocumentosObrigatorios)
	if err := g.Cargos.Atualizar(ctx, existente); err != nil {
		return traduzirErroCargo(err)
	}
	return nil
}

func traduzirErroCargo(err error) error {
	if err == dominio.ErrCargoDuplicado {
		return erroValidacao("Já existe um cargo com este nome.")
	}
	return err
}

// ---------- Departamento ----------

type GerenciadorDepartamentos struct {
	Departamentos dominio.DepartamentoRepositorio
}

// CriarRamo — um "ramo" é um Departamento sem pai. COMPORTAMENTO.md §2.
func (g *GerenciadorDepartamentos) CriarRamo(ctx context.Context, nome string) error {
	nome = strings.TrimSpace(nome)
	if len(nome) < 2 {
		return erroValidacao("Informe o nome do ramo.")
	}
	if err := g.Departamentos.Criar(ctx, &dominio.Departamento{Nome: nome}); err != nil {
		return traduzirErroDepartamento(err)
	}
	return nil
}

// CriarSetor exige um ramo já existente — a validação dos "dois níveis" mora aqui, não no
// schema (COMPORTAMENTO.md §2): um setor sempre aponta pra um ramo (PaiID != nil).
func (g *GerenciadorDepartamentos) CriarSetor(ctx context.Context, nome, ramoID string) error {
	nome = strings.TrimSpace(nome)
	if len(nome) < 2 {
		return erroValidacao("Informe o nome do setor.")
	}
	if strings.TrimSpace(ramoID) == "" {
		return erroValidacao("Escolha um ramo para o setor.")
	}
	ramo, err := g.Departamentos.BuscarPorID(ctx, ramoID)
	if err != nil {
		return err
	}
	if ramo == nil || ramo.PaiID != nil {
		return erroValidacao("Ramo inválido — escolha um ramo já cadastrado.")
	}
	if err := g.Departamentos.Criar(ctx, &dominio.Departamento{Nome: nome, PaiID: &ramoID}); err != nil {
		return traduzirErroDepartamento(err)
	}
	return nil
}

func traduzirErroDepartamento(err error) error {
	if err == dominio.ErrDepartamentoDuplicado {
		return erroValidacao("Já existe um departamento com este nome.")
	}
	return err
}
