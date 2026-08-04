// Package painel orquestra domínio + portas de repositório do Painel de Locação — ver
// ARQUITETURA.md §1 e migracao-go/painel/COMPORTAMENTO.md.
package painel

import (
	"context"
	"errors"
	"fmt"
	"strings"

	dominio "siqueiracampos/servidor/internal/domain/painel"
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

type GerenciadorObras struct {
	Obras dominio.ObraRepositorio
}

type EntradaObra struct {
	Cliente, Codigo, Descricao, Responsavel string
}

func (g *GerenciadorObras) validar(e EntradaObra) (cliente, codigo, descricao string, erros []string) {
	cliente = strings.TrimSpace(e.Cliente)
	if len(cliente) < 2 {
		erros = append(erros, "Informe o cliente.")
	}
	codigo = strings.TrimSpace(e.Codigo)
	if len(codigo) < 2 {
		erros = append(erros, "Informe o código da obra.")
	}
	descricao = strings.TrimSpace(e.Descricao)
	if len(descricao) < 2 {
		erros = append(erros, "Informe a descrição.")
	}
	return
}

// Salvar espelha `salvarObra` de actions/obras.ts — ver COMPORTAMENTO.md §4.1. id vazio cria.
func (g *GerenciadorObras) Salvar(ctx context.Context, id string, e EntradaObra) error {
	cliente, codigo, descricao, erros := g.validar(e)
	if len(erros) > 0 {
		return erroValidacao(erros...)
	}
	responsavel := ponteiro(e.Responsavel)

	if id == "" {
		o := &dominio.Obra{Cliente: cliente, Codigo: codigo, Descricao: descricao, Responsavel: responsavel, AbaOrigem: codigo}
		if err := g.Obras.Criar(ctx, o); err != nil {
			return traduzirErroObra(err, codigo)
		}
		return nil
	}

	existente, err := g.Obras.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if existente == nil {
		return erroValidacao("Obra não encontrada.")
	}
	existente.Cliente, existente.Codigo, existente.Descricao, existente.Responsavel = cliente, codigo, descricao, responsavel
	if err := g.Obras.Atualizar(ctx, existente); err != nil {
		return traduzirErroObra(err, codigo)
	}
	return nil
}

func traduzirErroObra(err error, codigo string) error {
	if errors.Is(err, dominio.ErrCodigoObraDuplicado) {
		return erroValidacao(fmt.Sprintf("Já existe uma obra com o código %s.", codigo))
	}
	return err
}

// Alternar desativa/ativa — ver COMPORTAMENTO.md §4.1: desativar recusa se houver locação
// em aberto.
func (g *GerenciadorObras) Alternar(ctx context.Context, id string, ativa bool) error {
	if !ativa {
		emUso, err := g.Obras.ContarLocacoesEmAberto(ctx, id)
		if err != nil {
			return err
		}
		if emUso > 0 {
			return erroValidacao(fmt.Sprintf(
				"Esta obra tem %d locações em aberto. Devolva ou transfira antes de desativar.", emUso))
		}
	}
	return g.Obras.AtualizarAtiva(ctx, id, ativa)
}
