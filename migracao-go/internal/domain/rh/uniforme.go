package rh

import (
	"context"
	"time"
)

const (
	PecaCamisa  = "CAMISA"
	PecaCalca   = "CALCA"
	PecaCalcado = "CALCADO"
	PecaOutro   = "OUTRO"
)

const (
	MotivoAdmissao   = "ADMISSAO"
	MotivoReposicao  = "REPOSICAO"
	MotivoTroca      = "TROCA"
	MotivoDanificado = "DANIFICADO"
)

type EntregaUniforme struct {
	ID            string
	Peca          string
	Tamanho       string
	Quantidade    int
	Motivo        string
	EntregueEm    time.Time
	Observacao    *string
	Assinatura    *string
	RegistradoPor *string
	FuncionarioID string
}

type EntregaUniformeComNome struct {
	EntregaUniforme
	FuncionarioNome string
}

type EntregaUniformeRepositorio interface {
	Listar(ctx context.Context) ([]EntregaUniformeComNome, error)
	Criar(ctx context.Context, e *EntregaUniforme) error
}
