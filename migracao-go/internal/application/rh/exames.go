package rh

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type GerenciadorExames struct {
	Exames dominio.ExameRepositorio
}

func (g *GerenciadorExames) Listar(ctx context.Context) ([]dominio.ExameComNome, error) {
	return g.Exames.Listar(ctx)
}

// AlertasVencimento — mesma janela fixa de 30 dias dos treinamentos (Vencendo/Vencido em
// treinamentos.go), COMPORTAMENTO.md §3.
func (g *GerenciadorExames) AlertasVencimento(ctx context.Context) ([]dominio.ExameComNome, error) {
	todos, err := g.Exames.Listar(ctx)
	if err != nil {
		return nil, err
	}
	hoje := time.Now().UTC()
	var alertas []dominio.ExameComNome
	for _, e := range todos {
		if Vencendo(e.ValidadeEm, hoje) {
			alertas = append(alertas, e)
		}
	}
	return alertas, nil
}

type EntradaExame struct {
	FuncionarioID, Tipo, RealizadoEm, ValidadeEm, Resultado, Restricoes string
}

func (g *GerenciadorExames) Criar(ctx context.Context, e EntradaExame, registradoPor string) error {
	if e.FuncionarioID == "" {
		return erroValidacao("Escolha o funcionário.")
	}
	realizadoEm, err := dataCalendario(e.RealizadoEm)
	if err != nil || realizadoEm == nil {
		return erroValidacao("Informe quando o exame foi realizado.")
	}
	validadeEm, _ := dataCalendario(e.ValidadeEm)
	if e.Resultado == "" {
		return erroValidacao("Escolha o resultado.")
	}

	exame := &dominio.Exame{
		Tipo: e.Tipo, RealizadoEm: *realizadoEm, ValidadeEm: validadeEm, Resultado: e.Resultado,
		Restricoes: ponteiro(e.Restricoes), RegistradoPor: ponteiro(registradoPor), FuncionarioID: e.FuncionarioID,
	}
	return g.Exames.Criar(ctx, exame)
}
