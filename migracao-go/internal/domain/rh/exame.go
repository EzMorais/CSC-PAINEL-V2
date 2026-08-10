package rh

import (
	"context"
	"time"
)

// Tipo de Exame (ASO) — COMPORTAMENTO.md §2.
const (
	ExameAdmissional     = "ADMISSIONAL"
	ExamePeriodico       = "PERIODICO"
	ExameRetornoTrabalho = "RETORNO_TRABALHO"
	ExameDemissional     = "DEMISSIONAL"
	ExameMudancaFuncao   = "MUDANCA_FUNCAO"
)

const (
	ResultadoApto             = "APTO"
	ResultadoInapto           = "INAPTO"
	ResultadoAptoComRestricao = "APTO_COM_RESTRICAO"
)

var RotuloResultado = map[string]string{
	ResultadoApto: "Apto", ResultadoInapto: "Inapto", ResultadoAptoComRestricao: "Apto com restrição",
}

type Exame struct {
	ID            string
	Tipo          string
	RealizadoEm   time.Time
	ValidadeEm    *time.Time
	Resultado     string
	Restricoes    *string
	Arquivo       *string
	RegistradoPor *string
	FuncionarioID string
}

// ExameComNome — projeção com o nome do funcionário, mesmo padrão de ParticipanteComNome e
// EntregaUniformeComNome.
type ExameComNome struct {
	Exame
	FuncionarioNome string
}

type ExameRepositorio interface {
	Listar(ctx context.Context) ([]ExameComNome, error)
	Criar(ctx context.Context, e *Exame) error
}
