package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHUniformeRepositorio struct{ DB *sql.DB }

func NovoRHUniformeRepositorio(db *sql.DB) *RHUniformeRepositorio {
	return &RHUniformeRepositorio{DB: db}
}

func (r *RHUniformeRepositorio) Listar(ctx context.Context) ([]rh.EntregaUniformeComNome, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT eu.id, eu.peca, eu.tamanho, eu.quantidade, eu.motivo, eu.entregue_em, eu.observacao,
		       eu.assinatura, eu.registrado_por, eu.funcionario_id, f.nome
		FROM entregas_uniforme eu
		JOIN funcionarios f ON f.id = eu.funcionario_id
		ORDER BY eu.entregue_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var entregas []rh.EntregaUniformeComNome
	for linhas.Next() {
		var e rh.EntregaUniformeComNome
		var observacao, assinatura, registradoPor sql.NullString
		var entregueEm string
		if err := linhas.Scan(&e.ID, &e.Peca, &e.Tamanho, &e.Quantidade, &e.Motivo, &entregueEm,
			&observacao, &assinatura, &registradoPor, &e.FuncionarioID, &e.FuncionarioNome); err != nil {
			return nil, err
		}
		e.Observacao, e.Assinatura, e.RegistradoPor = txt(observacao), txt(assinatura), txt(registradoPor)
		e.EntregueEm, _ = time.Parse(time.RFC3339, entregueEm)
		entregas = append(entregas, e)
	}
	return entregas, linhas.Err()
}

func (r *RHUniformeRepositorio) Criar(ctx context.Context, e *rh.EntregaUniforme) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO entregas_uniforme (id, peca, tamanho, quantidade, motivo, entregue_em, observacao, assinatura, registrado_por, funcionario_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, e.Peca, e.Tamanho, e.Quantidade, e.Motivo, rfc3339(&e.EntregueEm), e.Observacao, e.Assinatura, e.RegistradoPor, e.FuncionarioID,
	)
	if err != nil {
		return err
	}
	e.ID = id
	return nil
}
