package programacao

import (
	"context"
	"fmt"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type EntradaRecurso struct {
	Data, FrenteID, Tipo, Descricao, Placa, MotoristaNome, VeiculoLocalID string
	Destaque                                                              bool
}

var tiposRecursoValidos = map[string]bool{
	string(dominio.RecursoVeiculo): true, string(dominio.RecursoMaquina): true, string(dominio.RecursoAviso): true,
}

func (g *Gerenciador) AdicionarRecurso(ctx context.Context, s identidade.Sessao, e EntradaRecurso) (*dominio.Recurso, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não lança na programação")
	}
	frenteID := strings.TrimSpace(e.FrenteID)
	if frenteID == "" {
		return nil, fmt.Errorf("escolha a frente")
	}
	tipo := strings.ToUpper(strings.TrimSpace(e.Tipo))
	if !tiposRecursoValidos[tipo] {
		return nil, fmt.Errorf("tipo inválido")
	}
	descricao := strings.TrimSpace(e.Descricao)
	if len(descricao) < 2 {
		return nil, fmt.Errorf("informe o que vai aparecer")
	}
	data, err := dataCalendario(e.Data)
	if err != nil {
		return nil, err
	}

	p, err := g.Repo.CriarOuObterDia(ctx, data)
	if err != nil {
		return nil, err
	}
	ultimo, err := g.Repo.UltimaOrdemRecurso(ctx, p.ID, frenteID)
	if err != nil {
		return nil, err
	}

	recurso := &dominio.Recurso{
		ProgramacaoID: p.ID, FrenteID: frenteID, Tipo: dominio.TipoRecurso(tipo),
		Descricao: descricao, Placa: strPtr(e.Placa), MotoristaNome: strPtr(e.MotoristaNome),
		VeiculoLocalID: strPtr(e.VeiculoLocalID), Destaque: e.Destaque, Ordem: ultimo + 1,
	}
	if err = g.Repo.CriarRecurso(ctx, recurso); err != nil {
		return nil, err
	}
	return recurso, nil
}

func (g *Gerenciador) TirarRecurso(ctx context.Context, s identidade.Sessao, id string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não lança na programação")
	}
	atual, _, err := g.Repo.BuscarRecurso(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("item não encontrado")
	}
	return g.Repo.TirarRecurso(ctx, id)
}
