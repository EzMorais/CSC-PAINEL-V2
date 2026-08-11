package programacao

import (
	"context"
	"fmt"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type EntradaEscala struct {
	Data, FrenteID, Nome              string
	FuncionarioID, FuncionarioLocalID string
	FuncaoSigla                       string
}

func (g *Gerenciador) Escalar(ctx context.Context, s identidade.Sessao, e EntradaEscala) (*dominio.Escala, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não lança na programação")
	}
	frenteID := strings.TrimSpace(e.FrenteID)
	nome := strings.TrimSpace(e.Nome)
	if frenteID == "" {
		return nil, fmt.Errorf("escolha a frente")
	}
	if len(nome) < 2 {
		return nil, fmt.Errorf("informe o nome")
	}
	data, err := dataCalendario(e.Data)
	if err != nil {
		return nil, err
	}

	p, err := g.Repo.CriarOuObterDia(ctx, data)
	if err != nil {
		return nil, err
	}

	existente, err := g.Repo.BuscarEscalaPorNomeNaFrente(ctx, p.ID, frenteID, nome)
	if err != nil {
		return nil, err
	}
	if existente != nil {
		return nil, fmt.Errorf("%s já está nessa frente neste dia", nome)
	}

	ultima, err := g.Repo.UltimaOrdemEscala(ctx, p.ID, frenteID)
	if err != nil {
		return nil, err
	}

	escala := &dominio.Escala{
		ProgramacaoID: p.ID, FrenteID: frenteID, Nome: nome,
		FuncionarioID: strPtr(e.FuncionarioID), FuncionarioLocalID: strPtr(e.FuncionarioLocalID),
		FuncaoSigla: strPtr(e.FuncaoSigla), Ordem: ultima + 1,
	}
	if err = g.Repo.CriarEscala(ctx, escala); err != nil {
		return nil, err
	}
	return escala, nil
}

// MoverEscala muda a pessoa de frente — é o que arrastar o card faz na tela.
func (g *Gerenciador) MoverEscala(ctx context.Context, s identidade.Sessao, id, frenteID string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não lança na programação")
	}
	frenteID = strings.TrimSpace(frenteID)
	atual, _, err := g.Repo.BuscarEscala(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("escala não encontrada")
	}
	if atual.FrenteID == frenteID {
		return nil
	}
	jaEsta, err := g.Repo.BuscarEscalaPorNomeNaFrente(ctx, atual.ProgramacaoID, frenteID, atual.Nome)
	if err != nil {
		return err
	}
	if jaEsta != nil {
		return fmt.Errorf("%s já está nessa frente", atual.Nome)
	}
	ultima, err := g.Repo.UltimaOrdemEscala(ctx, atual.ProgramacaoID, frenteID)
	if err != nil {
		return err
	}
	return g.Repo.MoverEscala(ctx, id, frenteID, ultima+1)
}

func (g *Gerenciador) TirarEscala(ctx context.Context, s identidade.Sessao, id string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não lança na programação")
	}
	atual, _, err := g.Repo.BuscarEscala(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("escala não encontrada")
	}
	return g.Repo.TirarEscala(ctx, id)
}

func (g *Gerenciador) TrocarFuncao(ctx context.Context, s identidade.Sessao, id, funcaoSigla string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não lança na programação")
	}
	atual, _, err := g.Repo.BuscarEscala(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("escala não encontrada")
	}
	return g.Repo.TrocarFuncaoEscala(ctx, id, strPtr(funcaoSigla))
}
