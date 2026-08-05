// Package estoque orquestra domínio + portas de repositório do Almoxarifado — ver
// ARQUITETURA.md §1 e migracao-go/estoque/COMPORTAMENTO.md.
package estoque

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
)

// parseDataISO aceita "AAAA-MM-DD" (o que o <input type="date"> manda) — meia-noite UTC
// representando um dia de calendário, mesmo referencial do resto do sistema.
func parseDataISO(v string) *time.Time {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil
	}
	t = t.UTC()
	return &t
}

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

type GerenciadorMateriais struct {
	Materiais dominio.MaterialRepositorio
}

type EntradaMaterial struct {
	Nome, Categoria, Unidade, Localizacao, Observacao, CA, ValidadeCA string
	EstoqueMinimo                                                     string
}

func parseFloatOpcional(v string) float64 {
	v = strings.TrimSpace(strings.Replace(v, ",", ".", 1))
	n, _ := strconv.ParseFloat(v, 64)
	return n
}

func (g *GerenciadorMateriais) proximoCodigo(ctx context.Context) (string, error) {
	ultimo, err := g.Materiais.UltimoCodigo(ctx)
	if err != nil {
		return "", err
	}
	numero := 1
	if ultimo != "" {
		var soDigitos strings.Builder
		for _, c := range ultimo {
			if c >= '0' && c <= '9' {
				soDigitos.WriteRune(c)
			}
		}
		if n, err := strconv.Atoi(soDigitos.String()); err == nil {
			numero = n + 1
		}
	}
	return fmt.Sprintf("MAT-%04d", numero), nil
}

// paraEntidade valida e monta o Material — CA/ValidadeCA só ficam preenchidos em categoria
// EPI (ver COMPORTAMENTO.md §2): um saco de cimento com CA preenchido é dado errado que
// depois vazaria pra ficha de entrega de outro material.
func (g *GerenciadorMateriais) paraEntidade(e EntradaMaterial) (*dominio.Material, error) {
	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return nil, erroValidacao("Informe o nome do material.")
	}
	categoria := dominio.Categoria(e.Categoria)
	if !categoria.Valida() {
		return nil, erroValidacao("Categoria inválida.")
	}
	if !dominio.UnidadeValida(e.Unidade) {
		return nil, erroValidacao("Unidade inválida.")
	}

	m := &dominio.Material{
		Nome: nome, Categoria: categoria, Unidade: e.Unidade,
		EstoqueMinimo: parseFloatOpcional(e.EstoqueMinimo),
		Localizacao:   ponteiro(e.Localizacao), Observacao: ponteiro(e.Observacao),
	}
	if categoria == dominio.CategoriaEPI {
		m.CA = ponteiro(e.CA)
		m.ValidadeCA = parseDataISO(e.ValidadeCA)
	}
	return m, nil
}

func traduzirErroMaterial(err error) error {
	if errors.Is(err, dominio.ErrCodigoMaterialDuplicado) {
		return erroValidacao("Já existe um material com esse código. Recarregue a página e tente de novo.")
	}
	return err
}

func (g *GerenciadorMateriais) Criar(ctx context.Context, e EntradaMaterial) (string, error) {
	m, err := g.paraEntidade(e)
	if err != nil {
		return "", err
	}
	codigo, err := g.proximoCodigo(ctx)
	if err != nil {
		return "", err
	}
	m.Codigo = codigo
	if err := g.Materiais.Criar(ctx, m); err != nil {
		return "", traduzirErroMaterial(err)
	}
	return m.ID, nil
}

func (g *GerenciadorMateriais) Editar(ctx context.Context, id string, e EntradaMaterial) error {
	novo, err := g.paraEntidade(e)
	if err != nil {
		return err
	}
	existente, err := g.Materiais.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if existente == nil {
		return erroValidacao("Material não encontrado.")
	}
	novo.ID = existente.ID
	novo.Codigo = existente.Codigo
	novo.Ativo = existente.Ativo
	if err := g.Materiais.Atualizar(ctx, novo); err != nil {
		return traduzirErroMaterial(err)
	}
	return nil
}

// Alternar inativa em vez de excluir — ver COMPORTAMENTO.md §8: apagar levaria o histórico
// junto (FK cascade) e o extrato de uma obra passaria a mentir sobre o que ela recebeu.
func (g *GerenciadorMateriais) Alternar(ctx context.Context, id string, ativo bool) error {
	return g.Materiais.AtualizarAtivo(ctx, id, ativo)
}

func paraComSaldo(m dominio.Material, saldos map[string]float64, precos map[string]float64) dominio.MaterialComSaldo {
	saldo := saldos[m.ID]
	situacao := dominio.SituacaoDoSaldo(saldo, m.EstoqueMinimo)
	item := dominio.MaterialComSaldo{Material: m, Saldo: saldo, Situacao: situacao}
	if preco, ok := precos[m.ID]; ok {
		item.UltimoPreco = &preco
		valor := saldo * preco
		item.ValorEmEstoque = &valor
	}
	return item
}

// ListarComSaldo: 1 consulta de materiais + 1 agregação de saldo (todos de uma vez, nunca
// N+1) + 1 de últimos preços, junta em memória. Filtro de situação é aplicado DEPOIS — é
// campo derivado, não existe coluna pro SQL filtrar. Ver COMPORTAMENTO.md §8.
func (g *GerenciadorMateriais) ListarComSaldo(ctx context.Context, filtros dominio.FiltrosMaterial) ([]dominio.MaterialComSaldo, error) {
	materiais, err := g.Materiais.Listar(ctx, dominio.FiltrosMaterial{Busca: filtros.Busca, Categoria: filtros.Categoria})
	if err != nil {
		return nil, err
	}
	saldos, err := g.Materiais.SaldoPorMaterial(ctx)
	if err != nil {
		return nil, err
	}
	precos, err := g.Materiais.UltimoPrecoPorMaterial(ctx)
	if err != nil {
		return nil, err
	}

	linhas := make([]dominio.MaterialComSaldo, 0, len(materiais))
	for _, m := range materiais {
		item := paraComSaldo(m, saldos, precos)
		if filtros.Situacao != "" && string(item.Situacao) != filtros.Situacao {
			continue
		}
		linhas = append(linhas, item)
	}
	return linhas, nil
}

func (g *GerenciadorMateriais) ObterComSaldo(ctx context.Context, id string) (*dominio.MaterialComSaldo, error) {
	m, err := g.Materiais.BuscarPorID(ctx, id)
	if err != nil || m == nil {
		return nil, err
	}
	saldo, err := g.Materiais.SaldoDoMaterial(ctx, id)
	if err != nil {
		return nil, err
	}
	precos, err := g.Materiais.UltimoPrecoPorMaterial(ctx)
	if err != nil {
		return nil, err
	}
	item := paraComSaldo(*m, map[string]float64{id: saldo}, precos)
	return &item, nil
}
