package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/estoque"
)

type EstoqueAprovacaoRepositorio struct{ DB *sql.DB }

func NovoEstoqueAprovacaoRepositorio(db *sql.DB) *EstoqueAprovacaoRepositorio {
	return &EstoqueAprovacaoRepositorio{DB: db}
}

const colunasAprovacao = `id, tipo, status, dados, motivo, resumo, solicitante_id, solicitante_nome,
	aprovador_id, aprovador_nome, motivo_rejeicao, referencia_id, criado_em, decidido_em`

func lerAprovacao(linha linhaEscaneavel) (*estoque.Aprovacao, error) {
	var a estoque.Aprovacao
	var tipo, status, criadoEm string
	var decididoEm *string
	if err := linha.Scan(
		&a.ID, &tipo, &status, &a.Dados, &a.Motivo, &a.Resumo, &a.SolicitanteID, &a.SolicitanteNome,
		&a.AprovadorID, &a.AprovadorNome, &a.MotivoRejeicao, &a.ReferenciaID, &criadoEm, &decididoEm,
	); err != nil {
		return nil, err
	}
	a.Tipo = estoque.TipoAprovacao(tipo)
	a.Status = estoque.StatusAprovacao(status)
	a.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	if decididoEm != nil {
		t, _ := time.Parse(time.RFC3339, *decididoEm)
		a.DecididoEm = &t
	}
	return &a, nil
}

func (r *EstoqueAprovacaoRepositorio) BuscarPorID(ctx context.Context, id string) (*estoque.Aprovacao, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasAprovacao+` FROM aprovacoes_estoque WHERE id = ?`, id)
	a, err := lerAprovacao(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return a, err
}

func (r *EstoqueAprovacaoRepositorio) Listar(ctx context.Context, status string) ([]estoque.Aprovacao, error) {
	consulta := `SELECT ` + colunasAprovacao + ` FROM aprovacoes_estoque`
	var args []any
	if status != "" {
		consulta += ` WHERE status = ?`
		args = append(args, status)
	}
	consulta += ` ORDER BY status ASC, criado_em DESC LIMIT 200`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var aprovacoes []estoque.Aprovacao
	for linhas.Next() {
		a, err := lerAprovacao(linhas)
		if err != nil {
			return nil, err
		}
		aprovacoes = append(aprovacoes, *a)
	}
	return aprovacoes, linhas.Err()
}

func (r *EstoqueAprovacaoRepositorio) ContarPendentes(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM aprovacoes_estoque WHERE status = 'PENDENTE'`).Scan(&n)
	return n, err
}

func (r *EstoqueAprovacaoRepositorio) Criar(ctx context.Context, a *estoque.Aprovacao) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO aprovacoes_estoque (id, tipo, status, dados, motivo, resumo, solicitante_id, solicitante_nome, criado_em)
		VALUES (?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?)`,
		id, string(a.Tipo), a.Dados, a.Motivo, a.Resumo, a.SolicitanteID, a.SolicitanteNome, agora,
	)
	if err != nil {
		return err
	}
	a.ID = id
	a.Status = estoque.AprovacaoPendente
	a.CriadoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}

func (r *EstoqueAprovacaoRepositorio) Decidir(ctx context.Context, id string, status estoque.StatusAprovacao, aprovadorID, aprovadorNome string, motivoRejeicao, referenciaID *string) error {
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		UPDATE aprovacoes_estoque SET status = ?, aprovador_id = ?, aprovador_nome = ?,
			motivo_rejeicao = ?, referencia_id = ?, decidido_em = ?
		WHERE id = ?`,
		string(status), aprovadorID, aprovadorNome, motivoRejeicao, referenciaID, agora, id)
	return err
}
