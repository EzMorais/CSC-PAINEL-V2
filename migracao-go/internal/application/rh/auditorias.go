package rh

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type GerenciadorAuditorias struct {
	Auditorias       dominio.AuditoriaRepositorio
	NaoConformidades dominio.NaoConformidadeRepositorio
}

func (g *GerenciadorAuditorias) Listar(ctx context.Context) ([]dominio.AuditoriaComContexto, error) {
	return g.Auditorias.Listar(ctx)
}

func (g *GerenciadorAuditorias) Detalhe(ctx context.Context, id string) (*dominio.Auditoria, []dominio.AuditoriaItem, error) {
	a, err := g.Auditorias.BuscarPorID(ctx, id)
	if err != nil || a == nil {
		return a, nil, err
	}
	itens, err := g.Auditorias.ListarItens(ctx, id)
	return a, itens, err
}

type EntradaItemAuditoria struct {
	Descricao, Situacao, Evidencia string
}

// AdicionarItem — um item NAO_CONFORME gera automaticamente uma NaoConformidade vinculada
// (COMPORTAMENTO.md §3). No Go, a UI só tem um formulário (descrição+situação) pro item, sem
// campos próprios de NC — a NC nasce com gravidade MEDIA (ponto médio, ajustável depois na
// tela de Não Conformidades) e o título espelha a descrição do item.
func (g *GerenciadorAuditorias) AdicionarItem(ctx context.Context, auditoriaID string, e EntradaItemAuditoria, registradoPor string) error {
	if e.Descricao == "" {
		return erroValidacao("Descreva o item verificado.")
	}
	if e.Situacao == "" {
		return erroValidacao("Escolha a situação.")
	}
	item := &dominio.AuditoriaItem{
		Descricao: e.Descricao, Situacao: e.Situacao, Evidencia: ponteiro(e.Evidencia), AuditoriaID: auditoriaID,
	}
	if err := g.Auditorias.CriarItem(ctx, item); err != nil {
		return err
	}
	if e.Situacao == dominio.SituacaoNaoConforme {
		nc := &dominio.NaoConformidade{
			Titulo: e.Descricao, Descricao: e.Descricao, Gravidade: dominio.GravidadeMedia,
			Status: dominio.StatusNCAberta, RegistradoPor: ponteiro(registradoPor), AuditoriaItemID: &item.ID,
		}
		if err := g.NaoConformidades.Criar(ctx, nc); err != nil {
			return err
		}
	}
	return nil
}

type EntradaAuditoria struct {
	Titulo, Norma, ObraID, RealizadaEm, Responsavel string
}

func (g *GerenciadorAuditorias) Criar(ctx context.Context, e EntradaAuditoria, registradoPor string) (string, error) {
	if e.Titulo == "" {
		return "", erroValidacao("Descreva a auditoria.")
	}
	realizadaEm, err := dataCalendario(e.RealizadaEm)
	if err != nil || realizadaEm == nil {
		return "", erroValidacao("Informe quando a auditoria foi realizada.")
	}
	a := &dominio.Auditoria{
		Titulo: e.Titulo, Norma: ponteiro(e.Norma), RealizadaEm: *realizadaEm,
		Responsavel: ponteiro(e.Responsavel), RegistradoPor: ponteiro(registradoPor), ObraID: ponteiro(e.ObraID),
	}
	if err := g.Auditorias.Criar(ctx, a); err != nil {
		return "", err
	}
	return a.ID, nil
}

type GerenciadorNaoConformidades struct {
	NaoConformidades dominio.NaoConformidadeRepositorio
}

func (g *GerenciadorNaoConformidades) Listar(ctx context.Context) ([]dominio.NaoConformidade, error) {
	return g.NaoConformidades.Listar(ctx)
}

func (g *GerenciadorNaoConformidades) ContarAbertas(ctx context.Context) (int, error) {
	return g.NaoConformidades.ContarAbertas(ctx)
}

func (g *GerenciadorNaoConformidades) ContarVencidas(ctx context.Context) (int, error) {
	return g.NaoConformidades.ContarVencidas(ctx, time.Now().UTC())
}

type EntradaNaoConformidade struct {
	Titulo, Descricao, Gravidade, Responsavel, Prazo string
}

func (g *GerenciadorNaoConformidades) Criar(ctx context.Context, e EntradaNaoConformidade, registradoPor string) (string, error) {
	if e.Titulo == "" {
		return "", erroValidacao("Descreva a não conformidade.")
	}
	if e.Gravidade == "" {
		return "", erroValidacao("Escolha a gravidade.")
	}
	prazo, err := dataCalendario(e.Prazo)
	if err != nil {
		return "", erroValidacao("Prazo inválido.")
	}
	nc := &dominio.NaoConformidade{
		Titulo: e.Titulo, Descricao: e.Descricao, Gravidade: e.Gravidade, Responsavel: ponteiro(e.Responsavel),
		Prazo: prazo, Status: dominio.StatusNCAberta, RegistradoPor: ponteiro(registradoPor),
	}
	if err := g.NaoConformidades.Criar(ctx, nc); err != nil {
		return "", err
	}
	return nc.ID, nil
}
