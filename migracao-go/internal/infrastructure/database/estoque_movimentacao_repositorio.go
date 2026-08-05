package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/estoque"
)

type EstoqueMovimentacaoRepositorio struct{ DB *sql.DB }

func NovoEstoqueMovimentacaoRepositorio(db *sql.DB) *EstoqueMovimentacaoRepositorio {
	return &EstoqueMovimentacaoRepositorio{DB: db}
}

const colunasMovimentacaoBase = `mv.id, mv.tipo, mv.quantidade, mv.valor_unitario, mv.documento, mv.observacao,
	mv.ocorrido_em, mv.registrado_em, mv.registrado_por, mv.funcionario_id, mv.funcionario_nome,
	mv.sincronizado_em, mv.erro_sincronizacao, mv.material_id, mv.obra_id, mv.fornecedor_id,
	mt.codigo, mt.nome, mt.unidade, o.codigo, f.nome`

const juntaMovimentacao = `FROM movimentacoes_estoque mv
	JOIN materiais mt ON mt.id = mv.material_id
	LEFT JOIN obras o ON o.id = mv.obra_id
	LEFT JOIN fornecedores f ON f.id = mv.fornecedor_id`

func lerMovimentacao(linha linhaEscaneavel) (*estoque.Movimentacao, error) {
	var m estoque.Movimentacao
	var tipo string
	var ocorridoEm, registradoEm string
	var sincronizadoEm *string
	if err := linha.Scan(
		&m.ID, &tipo, &m.Quantidade, &m.ValorUnitario, &m.Documento, &m.Observacao,
		&ocorridoEm, &registradoEm, &m.RegistradoPor, &m.FuncionarioID, &m.FuncionarioNome,
		&sincronizadoEm, &m.ErroSincronizacao, &m.MaterialID, &m.ObraID, &m.FornecedorID,
		&m.MaterialCodigo, &m.MaterialNome, &m.MaterialUnidade, &m.ObraCodigo, &m.FornecedorNome,
	); err != nil {
		return nil, err
	}
	m.Tipo = estoque.TipoMovimentacao(tipo)
	m.OcorridoEm, _ = time.Parse(time.RFC3339, ocorridoEm)
	m.RegistradoEm, _ = time.Parse(time.RFC3339, registradoEm)
	if sincronizadoEm != nil {
		t, _ := time.Parse(time.RFC3339, *sincronizadoEm)
		m.SincronizadoEm = &t
	}
	return &m, nil
}

func (r *EstoqueMovimentacaoRepositorio) BuscarPorID(ctx context.Context, id string) (*estoque.Movimentacao, error) {
	linha := r.DB.QueryRowContext(ctx,
		`SELECT `+colunasMovimentacaoBase+` `+juntaMovimentacao+` WHERE mv.id = ?`, id)
	m, err := lerMovimentacao(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return m, err
}

func (r *EstoqueMovimentacaoRepositorio) Listar(ctx context.Context, filtros estoque.FiltrosMovimentacao, limite int) ([]estoque.Movimentacao, error) {
	consulta := `SELECT ` + colunasMovimentacaoBase + ` ` + juntaMovimentacao + ` WHERE 1=1`
	var args []any
	if filtros.Tipo != "" {
		consulta += ` AND mv.tipo = ?`
		args = append(args, filtros.Tipo)
	}
	if filtros.ObraID != "" {
		consulta += ` AND mv.obra_id = ?`
		args = append(args, filtros.ObraID)
	}
	if filtros.MaterialID != "" {
		consulta += ` AND mv.material_id = ?`
		args = append(args, filtros.MaterialID)
	}
	if busca := strings.TrimSpace(filtros.Busca); busca != "" {
		consulta += ` AND (mt.nome LIKE ? OR mt.codigo LIKE ? OR mv.documento LIKE ?)`
		termo := "%" + busca + "%"
		args = append(args, termo, termo, termo)
	}
	consulta += ` ORDER BY mv.ocorrido_em DESC, mv.registrado_em DESC LIMIT ?`
	args = append(args, limite)

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var movs []estoque.Movimentacao
	for linhas.Next() {
		m, err := lerMovimentacao(linhas)
		if err != nil {
			return nil, err
		}
		movs = append(movs, *m)
	}
	return movs, linhas.Err()
}

func (r *EstoqueMovimentacaoRepositorio) Recentes(ctx context.Context, limite int) ([]estoque.Movimentacao, error) {
	return r.Listar(ctx, estoque.FiltrosMovimentacao{}, limite)
}

func (r *EstoqueMovimentacaoRepositorio) Criar(ctx context.Context, m *estoque.Movimentacao) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO movimentacoes_estoque
			(id, tipo, quantidade, valor_unitario, documento, observacao, ocorrido_em, registrado_em,
			 registrado_por, funcionario_id, funcionario_nome, material_id, obra_id, fornecedor_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, string(m.Tipo), m.Quantidade, m.ValorUnitario, m.Documento, m.Observacao,
		m.OcorridoEm.UTC().Format(time.RFC3339), agora, m.RegistradoPor, m.FuncionarioID,
		m.FuncionarioNome, m.MaterialID, m.ObraID, m.FornecedorID,
	)
	if err != nil {
		return err
	}
	m.ID = id
	m.RegistradoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}

func (r *EstoqueMovimentacaoRepositorio) MarcarSincronizada(ctx context.Context, id string, erro *string) error {
	if erro != nil {
		_, err := r.DB.ExecContext(ctx,
			`UPDATE movimentacoes_estoque SET erro_sincronizacao = ? WHERE id = ?`, *erro, id)
		return err
	}
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx,
		`UPDATE movimentacoes_estoque SET sincronizado_em = ?, erro_sincronizacao = NULL WHERE id = ?`, agora, id)
	return err
}

func (r *EstoqueMovimentacaoRepositorio) ListarFichasPendentes(ctx context.Context) ([]estoque.Movimentacao, error) {
	linhas, err := r.DB.QueryContext(ctx,
		`SELECT `+colunasMovimentacaoBase+` `+juntaMovimentacao+`
		 WHERE mv.funcionario_id IS NOT NULL AND mv.sincronizado_em IS NULL
		 ORDER BY mv.ocorrido_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var movs []estoque.Movimentacao
	for linhas.Next() {
		m, err := lerMovimentacao(linhas)
		if err != nil {
			return nil, err
		}
		movs = append(movs, *m)
	}
	return movs, linhas.Err()
}

func (r *EstoqueMovimentacaoRepositorio) ContarPorTipoDesde(ctx context.Context, tipo estoque.TipoMovimentacao, desde string) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM movimentacoes_estoque WHERE tipo = ? AND ocorrido_em >= ?`,
		string(tipo), desde,
	).Scan(&n)
	return n, err
}

func (r *EstoqueMovimentacaoRepositorio) ConsumoPorObra(ctx context.Context) ([]estoque.LinhaConsumoObra, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT tipo, quantidade, material_id, obra_id FROM movimentacoes_estoque
		WHERE obra_id IS NOT NULL AND tipo IN ('SAIDA', 'DEVOLUCAO')`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var itens []estoque.LinhaConsumoObra
	for linhas.Next() {
		var tipo string
		var l estoque.LinhaConsumoObra
		if err := linhas.Scan(&tipo, &l.Quantidade, &l.MaterialID, &l.ObraID); err != nil {
			return nil, err
		}
		l.Tipo = estoque.TipoMovimentacao(tipo)
		itens = append(itens, l)
	}
	return itens, linhas.Err()
}
