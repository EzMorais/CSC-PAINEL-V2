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

type EstoqueMaterialRepositorio struct{ DB *sql.DB }

func NovoEstoqueMaterialRepositorio(db *sql.DB) *EstoqueMaterialRepositorio {
	return &EstoqueMaterialRepositorio{DB: db}
}

const colunasMaterial = `id, codigo, nome, categoria, unidade, estoque_minimo, localizacao, observacao, ativo, ca, validade_ca, criado_em, atualizado_em`

func lerMaterial(linha linhaEscaneavel) (*estoque.Material, error) {
	var m estoque.Material
	var categoria string
	var ativo int
	var validadeCA, criadoEm, atualizadoEm *string
	if err := linha.Scan(
		&m.ID, &m.Codigo, &m.Nome, &categoria, &m.Unidade, &m.EstoqueMinimo, &m.Localizacao,
		&m.Observacao, &ativo, &m.CA, &validadeCA, &criadoEm, &atualizadoEm,
	); err != nil {
		return nil, err
	}
	m.Categoria = estoque.Categoria(categoria)
	m.Ativo = ativo != 0
	if validadeCA != nil {
		t, _ := time.Parse(time.RFC3339, *validadeCA)
		m.ValidadeCA = &t
	}
	if criadoEm != nil {
		m.CriadoEm, _ = time.Parse(time.RFC3339, *criadoEm)
	}
	if atualizadoEm != nil {
		m.AtualizadoEm, _ = time.Parse(time.RFC3339, *atualizadoEm)
	}
	return &m, nil
}

func (r *EstoqueMaterialRepositorio) BuscarPorID(ctx context.Context, id string) (*estoque.Material, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasMaterial+` FROM materiais WHERE id = ?`, id)
	m, err := lerMaterial(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return m, err
}

func (r *EstoqueMaterialRepositorio) Listar(ctx context.Context, filtros estoque.FiltrosMaterial) ([]estoque.Material, error) {
	consulta := `SELECT ` + colunasMaterial + ` FROM materiais WHERE 1=1`
	var args []any
	if filtros.Categoria != "" {
		consulta += ` AND categoria = ?`
		args = append(args, filtros.Categoria)
	}
	if busca := strings.TrimSpace(filtros.Busca); busca != "" {
		consulta += ` AND (nome LIKE ? OR codigo LIKE ?)`
		termo := "%" + busca + "%"
		args = append(args, termo, termo)
	}
	consulta += ` ORDER BY ativo DESC, nome ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var materiais []estoque.Material
	for linhas.Next() {
		m, err := lerMaterial(linhas)
		if err != nil {
			return nil, err
		}
		materiais = append(materiais, *m)
	}
	return materiais, linhas.Err()
}

func (r *EstoqueMaterialRepositorio) Criar(ctx context.Context, m *estoque.Material) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	var validadeCA *string
	if m.ValidadeCA != nil {
		v := m.ValidadeCA.UTC().Format(time.RFC3339)
		validadeCA = &v
	}
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO materiais (id, codigo, nome, categoria, unidade, estoque_minimo, localizacao, observacao, ativo, ca, validade_ca, criado_em, atualizado_em)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
		id, m.Codigo, m.Nome, string(m.Categoria), m.Unidade, m.EstoqueMinimo, m.Localizacao,
		m.Observacao, m.CA, validadeCA, agora, agora,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: materiais.codigo") {
			return estoque.ErrCodigoMaterialDuplicado
		}
		return err
	}
	m.ID = id
	m.Ativo = true
	return nil
}

func (r *EstoqueMaterialRepositorio) Atualizar(ctx context.Context, m *estoque.Material) error {
	agora := time.Now().UTC().Format(time.RFC3339)
	var validadeCA *string
	if m.ValidadeCA != nil {
		v := m.ValidadeCA.UTC().Format(time.RFC3339)
		validadeCA = &v
	}
	_, err := r.DB.ExecContext(ctx, `
		UPDATE materiais SET nome = ?, categoria = ?, unidade = ?, estoque_minimo = ?,
			localizacao = ?, observacao = ?, ca = ?, validade_ca = ?, atualizado_em = ?
		WHERE id = ?`,
		m.Nome, string(m.Categoria), m.Unidade, m.EstoqueMinimo, m.Localizacao, m.Observacao,
		m.CA, validadeCA, agora, m.ID,
	)
	return err
}

func (r *EstoqueMaterialRepositorio) AtualizarAtivo(ctx context.Context, id string, ativo bool) error {
	v := 0
	if ativo {
		v = 1
	}
	_, err := r.DB.ExecContext(ctx, `UPDATE materiais SET ativo = ?, atualizado_em = ? WHERE id = ?`,
		v, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func (r *EstoqueMaterialRepositorio) UltimoCodigo(ctx context.Context) (string, error) {
	var codigo string
	err := r.DB.QueryRowContext(ctx, `SELECT codigo FROM materiais ORDER BY codigo DESC LIMIT 1`).Scan(&codigo)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return codigo, err
}

func (r *EstoqueMaterialRepositorio) SaldoPorMaterial(ctx context.Context) (map[string]float64, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT material_id, tipo, COALESCE(SUM(quantidade), 0)
		FROM movimentacoes_estoque GROUP BY material_id, tipo`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	saldos := map[string]float64{}
	for linhas.Next() {
		var materialID, tipo string
		var soma float64
		if err := linhas.Scan(&materialID, &tipo, &soma); err != nil {
			return nil, err
		}
		sinal := estoque.SinalMovimentacao[estoque.TipoMovimentacao(tipo)]
		saldos[materialID] += float64(sinal) * soma
	}
	return saldos, linhas.Err()
}

func (r *EstoqueMaterialRepositorio) SaldoDoMaterial(ctx context.Context, materialID string) (float64, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT tipo, COALESCE(SUM(quantidade), 0) FROM movimentacoes_estoque
		WHERE material_id = ? GROUP BY tipo`, materialID)
	if err != nil {
		return 0, err
	}
	defer linhas.Close()

	var saldo float64
	for linhas.Next() {
		var tipo string
		var soma float64
		if err := linhas.Scan(&tipo, &soma); err != nil {
			return 0, err
		}
		sinal := estoque.SinalMovimentacao[estoque.TipoMovimentacao(tipo)]
		saldo += float64(sinal) * soma
	}
	return saldo, linhas.Err()
}

// UltimoPrecoPorMaterial: custo de REPOSIÇÃO (última entrada), não contábil — ver COMPORTAMENTO.md §3.
func (r *EstoqueMaterialRepositorio) UltimoPrecoPorMaterial(ctx context.Context) (map[string]float64, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT material_id, valor_unitario FROM movimentacoes_estoque
		WHERE tipo = 'ENTRADA' AND valor_unitario IS NOT NULL
		ORDER BY ocorrido_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	precos := map[string]float64{}
	for linhas.Next() {
		var materialID string
		var preco float64
		if err := linhas.Scan(&materialID, &preco); err != nil {
			return nil, err
		}
		if _, ja := precos[materialID]; !ja {
			precos[materialID] = preco
		}
	}
	return precos, linhas.Err()
}
