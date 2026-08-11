package rh

import (
	"context"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

// GerenciadorRelatorios calcula os indicadores do resumo de SST — COMPORTAMENTO.md §7. A
// exportação em si (Excel/PDF) mora no handler, mesma separação do Painel de Locação
// (handlers/painel/exportar.go): aqui só há conta de negócio a testar, não formatação de arquivo.
type GerenciadorRelatorios struct {
	Funcionarios     dominio.FuncionarioRepositorio
	Treinamentos     dominio.TreinamentoRepositorio
	Exames           dominio.ExameRepositorio
	Auditorias       dominio.AuditoriaRepositorio
	NaoConformidades dominio.NaoConformidadeRepositorio
}

type IndicadoresSST struct {
	Ativos, Afastados, Ferias            int
	TreinamentosVencendo, ExamesVencendo int
	NCAbertas, NCVencidas                int
	Auditorias                           int
}

// Indicadores espelha `indicadores()` de exportar-resumo-pdf.ts. TreinamentosVencendo conta
// PARTICIPANTES (não turmas) de treinamentos cuja validade cai em até 30 dias — inclusive já
// vencidos, mesmo critério do `lte` do Prisma, que não tem piso inferior.
func (g *GerenciadorRelatorios) Indicadores(ctx context.Context, hoje time.Time) (*IndicadoresSST, error) {
	em30dias := hoje.Add(30 * 24 * time.Hour)

	porStatus, err := g.Funcionarios.ContarPorStatus(ctx)
	if err != nil {
		return nil, err
	}

	treinamentos, err := g.Treinamentos.Listar(ctx, "")
	if err != nil {
		return nil, err
	}
	treinamentosVencendo := 0
	for _, t := range treinamentos {
		if t.ValidadeEm == nil || t.ValidadeEm.After(em30dias) {
			continue
		}
		participantes, err := g.Treinamentos.ListarParticipantes(ctx, t.ID)
		if err != nil {
			return nil, err
		}
		treinamentosVencendo += len(participantes)
	}

	exames, err := g.Exames.Listar(ctx)
	if err != nil {
		return nil, err
	}
	examesVencendo := 0
	for _, e := range exames {
		if e.ValidadeEm != nil && !e.ValidadeEm.After(em30dias) {
			examesVencendo++
		}
	}

	ncAbertas, err := g.NaoConformidades.ContarAbertas(ctx)
	if err != nil {
		return nil, err
	}
	ncVencidas, err := g.NaoConformidades.ContarVencidas(ctx, hoje)
	if err != nil {
		return nil, err
	}

	auditorias, err := g.Auditorias.Listar(ctx)
	if err != nil {
		return nil, err
	}

	return &IndicadoresSST{
		Ativos: porStatus[dominio.StatusAtivo], Afastados: porStatus[dominio.StatusAfastado], Ferias: porStatus[dominio.StatusFerias],
		TreinamentosVencendo: treinamentosVencendo, ExamesVencendo: examesVencendo,
		NCAbertas: ncAbertas, NCVencidas: ncVencidas, Auditorias: len(auditorias),
	}, nil
}
