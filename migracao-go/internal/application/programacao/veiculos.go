package programacao

import (
	"context"
	"fmt"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type EntradaVeiculo struct{ Modelo, Placa, MotoristaNome, Foto string }

func (g *Gerenciador) CriarVeiculo(ctx context.Context, s identidade.Sessao, e EntradaVeiculo) (*dominio.Veiculo, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não cadastra veículos")
	}
	modelo := strings.TrimSpace(e.Modelo)
	if len(modelo) < 2 {
		return nil, fmt.Errorf("informe o modelo")
	}
	v := &dominio.Veiculo{Modelo: modelo, Placa: strPtr(e.Placa), MotoristaNome: strPtr(e.MotoristaNome), Foto: strPtr(e.Foto), Ativo: true}
	if err := g.Repo.CriarVeiculo(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (g *Gerenciador) EditarVeiculo(ctx context.Context, s identidade.Sessao, id string, e EntradaVeiculo) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não edita veículos")
	}
	modelo := strings.TrimSpace(e.Modelo)
	if len(modelo) < 2 {
		return fmt.Errorf("informe o modelo")
	}
	return g.Repo.AtualizarVeiculo(ctx, &dominio.Veiculo{
		ID: id, Modelo: modelo, Placa: strPtr(e.Placa), MotoristaNome: strPtr(e.MotoristaNome), Foto: strPtr(e.Foto), Ativo: true,
	})
}

func (g *Gerenciador) AlternarVeiculoAtivo(ctx context.Context, s identidade.Sessao, id string, ativo bool) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não altera veículos")
	}
	return g.Repo.AlternarVeiculoAtivo(ctx, id, ativo)
}
