package painel

import (
	"context"
	"errors"
	"fmt"
	"strings"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

type GerenciadorFornecedores struct {
	Fornecedores dominio.FornecedorRepositorio
}

type EntradaFornecedor struct {
	Nome, Telefone, Aliases string
}

func separarAliases(aliases string) []string {
	var lista []string
	for _, a := range strings.Split(aliases, ",") {
		a = strings.TrimSpace(a)
		if a != "" {
			lista = append(lista, a)
		}
	}
	return lista
}

// Salvar espelha `salvarFornecedor` — ver COMPORTAMENTO.md §4.2: recusa alias que já
// pertence a outro fornecedor ANTES de gravar (o repositório também recusaria via
// constraint, mas aqui a mensagem cita quem é o dono, o que exige a checagem explícita).
func (g *GerenciadorFornecedores) Salvar(ctx context.Context, id string, e EntradaFornecedor) error {
	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return erroValidacao("Informe o nome do fornecedor.")
	}
	telefone := ponteiro(e.Telefone)
	listaAliases := separarAliases(e.Aliases)

	if len(listaAliases) > 0 {
		donos, err := g.Fornecedores.DonosDeAliases(ctx, listaAliases, id)
		if err != nil {
			return err
		}
		if len(donos) > 0 {
			partes := make([]string, len(donos))
			for i, d := range donos {
				partes[i] = fmt.Sprintf("%q (de %s)", d.Alias, d.FornecedorNome)
			}
			return erroValidacao("Estes apelidos já pertencem a outro fornecedor: " + strings.Join(partes, ", ") + ".")
		}
	}

	if id == "" {
		f := &dominio.Fornecedor{Nome: nome, Telefone: telefone, Aliases: listaAliases}
		if err := g.Fornecedores.Criar(ctx, f); err != nil {
			return traduzirErroFornecedor(err, nome)
		}
		return nil
	}

	existente, err := g.Fornecedores.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if existente == nil {
		return erroValidacao("Fornecedor não encontrado.")
	}
	existente.Nome, existente.Telefone, existente.Aliases = nome, telefone, listaAliases
	if err := g.Fornecedores.Atualizar(ctx, existente); err != nil {
		return traduzirErroFornecedor(err, nome)
	}
	return nil
}

func traduzirErroFornecedor(err error, nome string) error {
	if errors.Is(err, dominio.ErrFornecedorDuplicado) || errors.Is(err, dominio.ErrAliasDeOutro) {
		return erroValidacao(fmt.Sprintf(
			"Já existe um fornecedor chamado %s, ou um dos apelidos já pertence a outro.", nome))
	}
	return err
}

func (g *GerenciadorFornecedores) Alternar(ctx context.Context, id string, ativo bool) error {
	return g.Fornecedores.AtualizarAtivo(ctx, id, ativo)
}
