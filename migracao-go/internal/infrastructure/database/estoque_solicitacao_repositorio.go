package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/estoque"
)

type EstoqueSolicitacaoRepositorio struct{ DB *sql.DB }

func NovoEstoqueSolicitacaoRepositorio(db *sql.DB) *EstoqueSolicitacaoRepositorio {
	return &EstoqueSolicitacaoRepositorio{DB: db}
}

const colunasSolicitacao = `id, numero, status, observacao, criado_em, enviada_em, atendida_em,
	registrado_por, email_enviado_para, email_enviado_em, email_erro`

func lerSolicitacao(linha linhaEscaneavel) (*estoque.SolicitacaoCompra, error) {
	var s estoque.SolicitacaoCompra
	var status, criadoEm string
	var enviadaEm, atendidaEm, emailEnviadoEm *string
	if err := linha.Scan(
		&s.ID, &s.Numero, &status, &s.Observacao, &criadoEm, &enviadaEm, &atendidaEm,
		&s.RegistradoPor, &s.EmailEnviadoPara, &emailEnviadoEm, &s.EmailErro,
	); err != nil {
		return nil, err
	}
	s.Status = estoque.StatusSolicitacao(status)
	s.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	if enviadaEm != nil {
		t, _ := time.Parse(time.RFC3339, *enviadaEm)
		s.EnviadaEm = &t
	}
	if atendidaEm != nil {
		t, _ := time.Parse(time.RFC3339, *atendidaEm)
		s.AtendidaEm = &t
	}
	if emailEnviadoEm != nil {
		t, _ := time.Parse(time.RFC3339, *emailEnviadoEm)
		s.EmailEnviadoEm = &t
	}
	return &s, nil
}

func (r *EstoqueSolicitacaoRepositorio) itensDe(ctx context.Context, solicitacaoID string) ([]estoque.ItemSolicitacao, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT i.id, i.quantidade, i.saldo_na_epoca, i.minimo_na_epoca, i.preco_estimado, i.observacao,
			i.solicitacao_id, i.material_id, m.codigo, m.nome, m.unidade
		FROM itens_solicitacao i JOIN materiais m ON m.id = i.material_id
		WHERE i.solicitacao_id = ? ORDER BY m.nome ASC`, solicitacaoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var itens []estoque.ItemSolicitacao
	for linhas.Next() {
		var it estoque.ItemSolicitacao
		if err := linhas.Scan(
			&it.ID, &it.Quantidade, &it.SaldoNaEpoca, &it.MinimoNaEpoca, &it.PrecoEstimado, &it.Observacao,
			&it.SolicitacaoID, &it.MaterialID, &it.MaterialCodigo, &it.MaterialNome, &it.MaterialUnidade,
		); err != nil {
			return nil, err
		}
		itens = append(itens, it)
	}
	return itens, linhas.Err()
}

func (r *EstoqueSolicitacaoRepositorio) BuscarPorID(ctx context.Context, id string) (*estoque.SolicitacaoCompra, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasSolicitacao+` FROM solicitacoes_compra WHERE id = ?`, id)
	s, err := lerSolicitacao(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	itens, err := r.itensDe(ctx, s.ID)
	if err != nil {
		return nil, err
	}
	s.Itens = itens
	return s, nil
}

func (r *EstoqueSolicitacaoRepositorio) Listar(ctx context.Context) ([]estoque.SolicitacaoCompra, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasSolicitacao+` FROM solicitacoes_compra ORDER BY criado_em DESC`)
	if err != nil {
		return nil, err
	}
	var solicitacoes []estoque.SolicitacaoCompra
	for linhas.Next() {
		s, err := lerSolicitacao(linhas)
		if err != nil {
			linhas.Close()
			return nil, err
		}
		solicitacoes = append(solicitacoes, *s)
	}
	if err := linhas.Err(); err != nil {
		linhas.Close()
		return nil, err
	}
	linhas.Close()

	// Itens carregados DEPOIS de fechar o cursor de fora — nunca aninhar query com Rows
	// ainda aberto, SetMaxOpenConns(1) deadlocaria (ver ARQUITETURA.md / lição do Portal).
	for i := range solicitacoes {
		itens, err := r.itensDe(ctx, solicitacoes[i].ID)
		if err != nil {
			return nil, err
		}
		solicitacoes[i].Itens = itens
	}
	return solicitacoes, nil
}

func (r *EstoqueSolicitacaoRepositorio) UltimoNumeroDoAno(ctx context.Context, prefixo string) (string, error) {
	var numero string
	err := r.DB.QueryRowContext(ctx,
		`SELECT numero FROM solicitacoes_compra WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`,
		prefixo+"%",
	).Scan(&numero)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return numero, err
}

func (r *EstoqueSolicitacaoRepositorio) Criar(ctx context.Context, s *estoque.SolicitacaoCompra) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO solicitacoes_compra (id, numero, status, observacao, criado_em, registrado_por)
		VALUES (?, ?, 'RASCUNHO', ?, ?, ?)`,
		id, s.Numero, s.Observacao, agora, s.RegistradoPor,
	); err != nil {
		return err
	}

	for _, it := range s.Itens {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO itens_solicitacao (id, quantidade, saldo_na_epoca, minimo_na_epoca, preco_estimado, observacao, solicitacao_id, material_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), it.Quantidade, it.SaldoNaEpoca, it.MinimoNaEpoca, it.PrecoEstimado, it.Observacao, id, it.MaterialID,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	s.ID = id
	s.Status = estoque.StatusRascunho
	s.CriadoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}

func (r *EstoqueSolicitacaoRepositorio) AtualizarStatus(ctx context.Context, id string, status estoque.StatusSolicitacao, enviadaEm, atendidaEm *string) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE solicitacoes_compra SET status = ?,
			enviada_em = COALESCE(?, enviada_em),
			atendida_em = COALESCE(?, atendida_em)
		WHERE id = ?`, string(status), enviadaEm, atendidaEm, id)
	return err
}

func (r *EstoqueSolicitacaoRepositorio) AtualizarEnvioEmail(ctx context.Context, id string, enviadoPara *string, enviadoEm *string, erro *string, status *estoque.StatusSolicitacao) error {
	if status != nil {
		_, err := r.DB.ExecContext(ctx, `
			UPDATE solicitacoes_compra SET email_enviado_para = ?, email_enviado_em = ?, email_erro = NULL,
				status = ?, enviada_em = ? WHERE id = ?`,
			enviadoPara, enviadoEm, string(*status), enviadoEm, id)
		return err
	}
	_, err := r.DB.ExecContext(ctx, `UPDATE solicitacoes_compra SET email_erro = ? WHERE id = ?`, erro, id)
	return err
}

func (r *EstoqueSolicitacaoRepositorio) Excluir(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM solicitacoes_compra WHERE id = ?`, id)
	return err
}

func (r *EstoqueSolicitacaoRepositorio) ContarAbertas(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM solicitacoes_compra WHERE status IN ('RASCUNHO', 'ENVIADA')`).Scan(&n)
	return n, err
}
