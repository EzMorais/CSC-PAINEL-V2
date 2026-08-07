package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHEpiRepositorio struct{ DB *sql.DB }

func NovoRHEpiRepositorio(db *sql.DB) *RHEpiRepositorio { return &RHEpiRepositorio{DB: db} }

const colunasEpi = `id, movimentacao_id, material_codigo, material_nome, ca, validade_ca, quantidade,
	unidade, entregue_em, observacao, entregue_por, recebido_em, funcionario_id`

func lerEpi(linha interface{ Scan(...any) error }) (rh.EntregaEpi, error) {
	var e rh.EntregaEpi
	var ca, validadeCA, observacao, entreguePor sql.NullString
	var entregueEm, recebidoEm string
	if err := linha.Scan(&e.ID, &e.MovimentacaoID, &e.MaterialCodigo, &e.MaterialNome, &ca, &validadeCA,
		&e.Quantidade, &e.Unidade, &entregueEm, &observacao, &entreguePor, &recebidoEm, &e.FuncionarioID); err != nil {
		return e, err
	}
	e.CA, e.ValidadeCA, e.Observacao, e.EntreguePor = txt(ca), txt(validadeCA), txt(observacao), txt(entreguePor)
	e.EntregueEm, _ = time.Parse(time.RFC3339, entregueEm)
	e.RecebidoEm, _ = time.Parse(time.RFC3339, recebidoEm)
	return e, nil
}

func (r *RHEpiRepositorio) BuscarPorMovimentacaoID(ctx context.Context, movimentacaoID string) (*rh.EntregaEpi, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasEpi+` FROM entregas_epi WHERE movimentacao_id = ?`, movimentacaoID)
	e, err := lerEpi(linha)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *RHEpiRepositorio) Criar(ctx context.Context, e *rh.EntregaEpi) error {
	id := uuid.NewString()
	recebidoEm := time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO entregas_epi (id, movimentacao_id, material_codigo, material_nome, ca, validade_ca,
			quantidade, unidade, entregue_em, observacao, entregue_por, recebido_em, funcionario_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, e.MovimentacaoID, e.MaterialCodigo, e.MaterialNome, e.CA, e.ValidadeCA, e.Quantidade, e.Unidade,
		rfc3339(&e.EntregueEm), e.Observacao, e.EntreguePor, recebidoEm.Format(time.RFC3339), e.FuncionarioID,
	)
	if err != nil {
		return err
	}
	e.ID = id
	e.RecebidoEm = recebidoEm
	return nil
}

func (r *RHEpiRepositorio) Listar(ctx context.Context) ([]rh.EntregaEpiComNome, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT ee.id, ee.movimentacao_id, ee.material_codigo, ee.material_nome, ee.ca, ee.validade_ca,
		       ee.quantidade, ee.unidade, ee.entregue_em, ee.observacao, ee.entregue_por, ee.recebido_em,
		       ee.funcionario_id, f.nome
		FROM entregas_epi ee
		JOIN funcionarios f ON f.id = ee.funcionario_id
		ORDER BY ee.entregue_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var entregas []rh.EntregaEpiComNome
	for linhas.Next() {
		var e rh.EntregaEpiComNome
		var ca, validadeCA, observacao, entreguePor sql.NullString
		var entregueEm, recebidoEm string
		if err := linhas.Scan(&e.ID, &e.MovimentacaoID, &e.MaterialCodigo, &e.MaterialNome, &ca, &validadeCA,
			&e.Quantidade, &e.Unidade, &entregueEm, &observacao, &entreguePor, &recebidoEm, &e.FuncionarioID, &e.FuncionarioNome); err != nil {
			return nil, err
		}
		e.CA, e.ValidadeCA, e.Observacao, e.EntreguePor = txt(ca), txt(validadeCA), txt(observacao), txt(entreguePor)
		e.EntregueEm, _ = time.Parse(time.RFC3339, entregueEm)
		e.RecebidoEm, _ = time.Parse(time.RFC3339, recebidoEm)
		entregas = append(entregas, e)
	}
	return entregas, linhas.Err()
}

func (r *RHEpiRepositorio) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]rh.EntregaEpi, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasEpi+` FROM entregas_epi WHERE funcionario_id = ? ORDER BY entregue_em DESC`, funcionarioID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var entregas []rh.EntregaEpi
	for linhas.Next() {
		e, err := lerEpi(linhas)
		if err != nil {
			return nil, err
		}
		entregas = append(entregas, e)
	}
	return entregas, linhas.Err()
}
