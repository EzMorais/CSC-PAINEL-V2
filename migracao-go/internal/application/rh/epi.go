package rh

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

// ErroFuncionarioInexistente — 422 na integração (COMPORTAMENTO.md §6), distinto de
// ErroValidacao (400, corpo mal formado) para o handler escolher o status certo.
type ErroFuncionarioInexistente struct{}

func (ErroFuncionarioInexistente) Error() string { return "Funcionário não encontrado no RH." }

type GerenciadorEpi struct {
	Epi          dominio.EntregaEpiRepositorio
	Funcionarios dominio.FuncionarioRepositorio
}

type EntradaFichaEpi struct {
	MovimentacaoID, FuncionarioID, MaterialCodigo, MaterialNome, Unidade, EntregueEm string
	Quantidade                                                                       float64
	CA, ValidadeCA                                                                   *string
}

// Receber — chamada pelo Almoxarifado via POST /api/integracao/entregas-epi. Idempotente por
// MovimentacaoID: reenvio do mesmo id devolve (true, nil) sem duplicar a ficha
// (COMPORTAMENTO.md §6).
func (g *GerenciadorEpi) Receber(ctx context.Context, e EntradaFichaEpi) (duplicada bool, err error) {
	if e.MovimentacaoID == "" || e.FuncionarioID == "" || e.MaterialCodigo == "" || e.MaterialNome == "" || e.Unidade == "" {
		return false, erroValidacao("Corpo inválido: movimentacaoId, funcionarioId, materialCodigo, materialNome e unidade são obrigatórios.")
	}

	existente, err := g.Epi.BuscarPorMovimentacaoID(ctx, e.MovimentacaoID)
	if err != nil {
		return false, err
	}
	if existente != nil {
		return true, nil
	}

	f, err := g.Funcionarios.BuscarPorID(ctx, e.FuncionarioID)
	if err != nil {
		return false, err
	}
	if f == nil {
		return false, ErroFuncionarioInexistente{}
	}

	entregueEm, err := dataCalendario(e.EntregueEm)
	if err != nil || entregueEm == nil {
		entregueEm = ponteiroTempo(time.Now().UTC())
	}

	ficha := &dominio.EntregaEpi{
		MovimentacaoID: e.MovimentacaoID, MaterialCodigo: e.MaterialCodigo, MaterialNome: e.MaterialNome,
		CA: e.CA, ValidadeCA: e.ValidadeCA, Quantidade: e.Quantidade, Unidade: e.Unidade,
		EntregueEm: *entregueEm, FuncionarioID: e.FuncionarioID,
	}
	return false, g.Epi.Criar(ctx, ficha)
}

func (g *GerenciadorEpi) Listar(ctx context.Context) ([]dominio.EntregaEpiComNome, error) {
	return g.Epi.Listar(ctx)
}

func (g *GerenciadorEpi) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]dominio.EntregaEpi, error) {
	return g.Epi.ListarPorFuncionario(ctx, funcionarioID)
}

func ponteiroTempo(t time.Time) *time.Time { return &t }
