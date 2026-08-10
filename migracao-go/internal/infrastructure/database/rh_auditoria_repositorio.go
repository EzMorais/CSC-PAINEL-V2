package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHAuditoriaRepositorio struct{ DB *sql.DB }

func NovoRHAuditoriaRepositorio(db *sql.DB) *RHAuditoriaRepositorio {
	return &RHAuditoriaRepositorio{DB: db}
}

func (r *RHAuditoriaRepositorio) Listar(ctx context.Context) ([]rh.AuditoriaComContexto, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT a.id, a.titulo, a.norma, a.realizada_em, a.responsavel, a.registrado_por, a.obra_id, o.codigo,
		       (SELECT COUNT(*) FROM auditoria_itens WHERE auditoria_id = a.id),
		       (SELECT COUNT(*) FROM auditoria_itens WHERE auditoria_id = a.id AND situacao = ?)
		FROM auditorias a
		LEFT JOIN obras o ON o.id = a.obra_id
		ORDER BY a.realizada_em DESC`, rh.SituacaoNaoConforme)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var auditorias []rh.AuditoriaComContexto
	for linhas.Next() {
		var a rh.AuditoriaComContexto
		var norma, responsavel, registradoPor, obraID, obraCodigo sql.NullString
		var realizadaEm string
		if err := linhas.Scan(&a.ID, &a.Titulo, &norma, &realizadaEm, &responsavel, &registradoPor, &obraID, &obraCodigo,
			&a.TotalItens, &a.TotalReprovado); err != nil {
			return nil, err
		}
		a.Norma, a.Responsavel, a.RegistradoPor = txt(norma), txt(responsavel), txt(registradoPor)
		a.ObraID, a.ObraCodigo = txt(obraID), txt(obraCodigo)
		a.RealizadaEm, _ = time.Parse(time.RFC3339, realizadaEm)
		auditorias = append(auditorias, a)
	}
	return auditorias, linhas.Err()
}

func (r *RHAuditoriaRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Auditoria, error) {
	var a rh.Auditoria
	var norma, responsavel, registradoPor, obraID sql.NullString
	var realizadaEm string
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, titulo, norma, realizada_em, responsavel, registrado_por, obra_id
		FROM auditorias WHERE id = ?`, id,
	).Scan(&a.ID, &a.Titulo, &norma, &realizadaEm, &responsavel, &registradoPor, &obraID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.Norma, a.Responsavel, a.RegistradoPor, a.ObraID = txt(norma), txt(responsavel), txt(registradoPor), txt(obraID)
	a.RealizadaEm, _ = time.Parse(time.RFC3339, realizadaEm)
	return &a, nil
}

func (r *RHAuditoriaRepositorio) Criar(ctx context.Context, a *rh.Auditoria) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO auditorias (id, titulo, norma, realizada_em, responsavel, registrado_por, obra_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, a.Titulo, a.Norma, rfc3339(&a.RealizadaEm), a.Responsavel, a.RegistradoPor, a.ObraID,
	)
	if err != nil {
		return err
	}
	a.ID = id
	return nil
}

func (r *RHAuditoriaRepositorio) ListarItens(ctx context.Context, auditoriaID string) ([]rh.AuditoriaItem, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT id, descricao, situacao, evidencia, auditoria_id FROM auditoria_itens
		WHERE auditoria_id = ? ORDER BY rowid ASC`, auditoriaID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var itens []rh.AuditoriaItem
	for linhas.Next() {
		var it rh.AuditoriaItem
		var evidencia sql.NullString
		if err := linhas.Scan(&it.ID, &it.Descricao, &it.Situacao, &evidencia, &it.AuditoriaID); err != nil {
			return nil, err
		}
		it.Evidencia = txt(evidencia)
		itens = append(itens, it)
	}
	return itens, linhas.Err()
}

func (r *RHAuditoriaRepositorio) CriarItem(ctx context.Context, item *rh.AuditoriaItem) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO auditoria_itens (id, descricao, situacao, evidencia, auditoria_id)
		VALUES (?, ?, ?, ?, ?)`,
		id, item.Descricao, item.Situacao, item.Evidencia, item.AuditoriaID,
	)
	if err != nil {
		return err
	}
	item.ID = id
	return nil
}

type RHNaoConformidadeRepositorio struct{ DB *sql.DB }

func NovoRHNaoConformidadeRepositorio(db *sql.DB) *RHNaoConformidadeRepositorio {
	return &RHNaoConformidadeRepositorio{DB: db}
}

func (r *RHNaoConformidadeRepositorio) Listar(ctx context.Context) ([]rh.NaoConformidade, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT id, titulo, descricao, gravidade, responsavel, prazo, status, evidencia_antes,
		       evidencia_depois, registrado_por, resolvido_em, criado_em, auditoria_item_id
		FROM nao_conformidades ORDER BY status ASC, prazo ASC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var ncs []rh.NaoConformidade
	for linhas.Next() {
		var nc rh.NaoConformidade
		var responsavel, prazo, evidenciaAntes, evidenciaDepois, registradoPor, resolvidoEm, auditoriaItemID sql.NullString
		var criadoEm string
		if err := linhas.Scan(&nc.ID, &nc.Titulo, &nc.Descricao, &nc.Gravidade, &responsavel, &prazo, &nc.Status,
			&evidenciaAntes, &evidenciaDepois, &registradoPor, &resolvidoEm, &criadoEm, &auditoriaItemID); err != nil {
			return nil, err
		}
		nc.Responsavel, nc.EvidenciaAntes, nc.EvidenciaDepois = txt(responsavel), txt(evidenciaAntes), txt(evidenciaDepois)
		nc.RegistradoPor, nc.AuditoriaItemID = txt(registradoPor), txt(auditoriaItemID)
		nc.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
		if prazo.Valid {
			p, _ := time.Parse(time.RFC3339, prazo.String)
			nc.Prazo = &p
		}
		if resolvidoEm.Valid {
			re, _ := time.Parse(time.RFC3339, resolvidoEm.String)
			nc.ResolvidoEm = &re
		}
		ncs = append(ncs, nc)
	}
	return ncs, linhas.Err()
}

func (r *RHNaoConformidadeRepositorio) Criar(ctx context.Context, nc *rh.NaoConformidade) error {
	id := uuid.NewString()
	agora := time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO nao_conformidades (id, titulo, descricao, gravidade, responsavel, prazo, status,
			evidencia_antes, evidencia_depois, registrado_por, resolvido_em, criado_em, auditoria_item_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, nc.Titulo, nc.Descricao, nc.Gravidade, nc.Responsavel, rfc3339(nc.Prazo), nc.Status,
		nc.EvidenciaAntes, nc.EvidenciaDepois, nc.RegistradoPor, rfc3339(nc.ResolvidoEm), agora.Format(time.RFC3339), nc.AuditoriaItemID,
	)
	if err != nil {
		return err
	}
	nc.ID = id
	nc.CriadoEm = agora
	return nil
}

func (r *RHNaoConformidadeRepositorio) ContarAbertas(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM nao_conformidades WHERE status != ?`, rh.StatusNCResolvida).Scan(&n)
	return n, err
}

func (r *RHNaoConformidadeRepositorio) ContarVencidas(ctx context.Context, hoje time.Time) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM nao_conformidades WHERE status != ? AND prazo IS NOT NULL AND prazo < ?`,
		rh.StatusNCResolvida, hoje.UTC().Format(time.RFC3339)).Scan(&n)
	return n, err
}
