package rh

import (
	"context"
	"time"
)

const (
	SituacaoConforme    = "CONFORME"
	SituacaoNaoConforme = "NAO_CONFORME"
	SituacaoNaoSeAplica = "NAO_SE_APLICA"
)

var RotuloSituacao = map[string]string{
	SituacaoConforme: "Conforme", SituacaoNaoConforme: "Não conforme", SituacaoNaoSeAplica: "Não se aplica",
}

const (
	GravidadeBaixa = "BAIXA"
	GravidadeMedia = "MEDIA"
	GravidadeAlta  = "ALTA"
)

const (
	StatusNCAberta      = "ABERTA"
	StatusNCEmAndamento = "EM_ANDAMENTO"
	StatusNCResolvida   = "RESOLVIDA"
)

// Auditoria — checklist de campo, opcionalmente ligada a uma Obra. COMPORTAMENTO.md §2.
type Auditoria struct {
	ID            string
	Titulo        string
	Norma         *string
	RealizadaEm   time.Time
	Responsavel   *string
	RegistradoPor *string
	ObraID        *string
}

type AuditoriaComContexto struct {
	Auditoria
	ObraCodigo    *string
	TotalItens    int
	TotalReprovado int
}

// AuditoriaItem — relação opcional 1:1 com NaoConformidade, sentido NC→Item (um item pode
// nunca reprovar) — COMPORTAMENTO.md §2.
type AuditoriaItem struct {
	ID          string
	Descricao   string
	Situacao    string
	Evidencia   *string
	AuditoriaID string
}

// NaoConformidade pode nascer solta ou a partir de um item reprovado (AuditoriaItemID —
// no máximo uma por item, COMPORTAMENTO.md §2/§3).
type NaoConformidade struct {
	ID              string
	Titulo          string
	Descricao       string
	Gravidade       string
	Responsavel     *string
	Prazo           *time.Time
	Status          string
	EvidenciaAntes  *string
	EvidenciaDepois *string
	RegistradoPor   *string
	ResolvidoEm     *time.Time
	CriadoEm        time.Time
	AuditoriaItemID *string
}

type AuditoriaRepositorio interface {
	Listar(ctx context.Context) ([]AuditoriaComContexto, error)
	BuscarPorID(ctx context.Context, id string) (*Auditoria, error)
	Criar(ctx context.Context, a *Auditoria) error
	ListarItens(ctx context.Context, auditoriaID string) ([]AuditoriaItem, error)
	CriarItem(ctx context.Context, item *AuditoriaItem) error
}

type NaoConformidadeRepositorio interface {
	Listar(ctx context.Context) ([]NaoConformidade, error)
	Criar(ctx context.Context, nc *NaoConformidade) error
	ContarAbertas(ctx context.Context) (int, error)
	ContarVencidas(ctx context.Context, hoje time.Time) (int, error)
}
