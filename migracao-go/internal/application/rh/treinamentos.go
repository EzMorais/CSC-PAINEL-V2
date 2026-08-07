package rh

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

const janelaVencimentoDias = 30

type GerenciadorTreinamentos struct {
	Treinamentos dominio.TreinamentoRepositorio
}

func (g *GerenciadorTreinamentos) Listar(ctx context.Context, busca string) ([]dominio.Treinamento, error) {
	return g.Treinamentos.Listar(ctx, busca)
}

// Vencendo — janela fixa de 30 dias, COMPORTAMENTO.md §3: "vencendo" = validadeEm <=
// hoje+30dias; "vencido" = validadeEm < hoje. Registro sem validadeEm NUNCA aparece.
func Vencendo(validadeEm *time.Time, hoje time.Time) bool {
	if validadeEm == nil {
		return false
	}
	limite := hoje.AddDate(0, 0, janelaVencimentoDias)
	return !validadeEm.After(limite)
}

func Vencido(validadeEm *time.Time, hoje time.Time) bool {
	if validadeEm == nil {
		return false
	}
	return validadeEm.Before(hoje)
}

// AlertasVencimento devolve os treinamentos que vencem dentro da janela (inclui os já
// vencidos) — mesma regra usada por exames/documentos.
func (g *GerenciadorTreinamentos) AlertasVencimento(ctx context.Context) ([]dominio.Treinamento, error) {
	todos, err := g.Treinamentos.Listar(ctx, "")
	if err != nil {
		return nil, err
	}
	hoje := time.Now().UTC()
	var alertas []dominio.Treinamento
	for _, t := range todos {
		if Vencendo(t.ValidadeEm, hoje) {
			alertas = append(alertas, t)
		}
	}
	return alertas, nil
}

func (g *GerenciadorTreinamentos) Detalhe(ctx context.Context, id string) (*dominio.Treinamento, []dominio.ParticipanteComNome, error) {
	t, err := g.Treinamentos.BuscarPorID(ctx, id)
	if err != nil || t == nil {
		return t, nil, err
	}
	participantes, err := g.Treinamentos.ListarParticipantes(ctx, id)
	return t, participantes, err
}

type EntradaTreinamento struct {
	Norma, Descricao, Instrutor, CargaHoraria, RealizadoEm, ValidadeEm string
}

func (g *GerenciadorTreinamentos) Criar(ctx context.Context, e EntradaTreinamento) (string, error) {
	descricao := ponteiro(e.Descricao)
	if descricao == nil {
		return "", erroValidacao("Descreva a turma.")
	}
	realizadoEm, err := dataCalendario(e.RealizadoEm)
	if err != nil || realizadoEm == nil {
		return "", erroValidacao("Informe quando foi realizado.")
	}
	validadeEm, _ := dataCalendario(e.ValidadeEm)

	t := &dominio.Treinamento{
		Norma: e.Norma, Descricao: *descricao, Instrutor: ponteiro(e.Instrutor),
		RealizadoEm: *realizadoEm, ValidadeEm: validadeEm,
	}
	if err := g.Treinamentos.Criar(ctx, t); err != nil {
		return "", err
	}
	return t.ID, nil
}

func (g *GerenciadorTreinamentos) AdicionarParticipante(ctx context.Context, treinamentoID, funcionarioID string) error {
	if funcionarioID == "" {
		return erroValidacao("Escolha um funcionário.")
	}
	return g.Treinamentos.AdicionarParticipante(ctx, &dominio.TreinamentoParticipante{
		TreinamentoID: treinamentoID, FuncionarioID: funcionarioID,
	})
}
