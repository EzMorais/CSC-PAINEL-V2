package rh

import (
	"context"
	"time"
)

// Norma — COMPORTAMENTO.md §2. ValidadeEm é digitado por quem registra, nunca calculado a
// partir da norma (prazos de reciclagem variam por NR).
const (
	NormaNR10  = "NR_10"
	NormaNR18  = "NR_18"
	NormaNR33  = "NR_33"
	NormaNR35  = "NR_35"
	NormaOutra = "OUTRA"
)

type Treinamento struct {
	ID           string
	Norma        string
	Descricao    string
	Instrutor    *string
	CargaHoraria *float64
	RealizadoEm  time.Time
	ValidadeEm   *time.Time
}

type TreinamentoParticipante struct {
	ID            string
	Certificado   *string
	TreinamentoID string
	FuncionarioID string
}

// ParticipanteComNome — projeção com o nome do funcionário, já resolvido via JOIN (mesmo
// banco físico; RH/Funcionario e Treinamento moram nas mesmas tabelas SQLite, só
// organizados em arquivos/pacotes Go separados por convenção).
type ParticipanteComNome struct {
	TreinamentoParticipante
	FuncionarioNome string
}

type FuncionarioOpcao struct {
	ID, Nome string
}

type TreinamentoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Treinamento, error)
	Listar(ctx context.Context, busca string) ([]Treinamento, error)
	Criar(ctx context.Context, t *Treinamento) error
	ListarParticipantes(ctx context.Context, treinamentoID string) ([]ParticipanteComNome, error)
	AdicionarParticipante(ctx context.Context, p *TreinamentoParticipante) error
	// ListarElegiveisParaTurma — quem não está DESLIGADO e ainda não é participante desta
	// turma. COMPORTAMENTO.md §2 (queries/treinamentos.ts).
	ListarElegiveisParaTurma(ctx context.Context, treinamentoID string) ([]FuncionarioOpcao, error)
}
