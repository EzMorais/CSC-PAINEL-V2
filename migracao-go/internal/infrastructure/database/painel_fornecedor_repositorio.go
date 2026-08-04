package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/painel"
)

type FornecedorRepositorio struct{ DB *sql.DB }

func NovoFornecedorRepositorio(db *sql.DB) *FornecedorRepositorio {
	return &FornecedorRepositorio{DB: db}
}

const colunasFornecedor = `id, nome, telefone, ativo, criado_em`

func lerFornecedor(linha linhaEscaneavel) (*painel.Fornecedor, error) {
	var f painel.Fornecedor
	var ativo int
	var criadoEm string
	if err := linha.Scan(&f.ID, &f.Nome, &f.Telefone, &ativo, &criadoEm); err != nil {
		return nil, err
	}
	f.Ativo = ativo != 0
	f.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	return &f, nil
}

func (r *FornecedorRepositorio) aliasesDe(ctx context.Context, fornecedorID string) ([]string, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT alias FROM fornecedor_aliases WHERE fornecedor_id = ?`, fornecedorID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()
	var aliases []string
	for linhas.Next() {
		var a string
		if err := linhas.Scan(&a); err != nil {
			return nil, err
		}
		aliases = append(aliases, a)
	}
	return aliases, linhas.Err()
}

func (r *FornecedorRepositorio) buscar(ctx context.Context, condicao, arg string) (*painel.Fornecedor, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasFornecedor+` FROM fornecedores WHERE `+condicao, arg)
	f, err := lerFornecedor(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	aliases, err := r.aliasesDe(ctx, f.ID)
	if err != nil {
		return nil, err
	}
	f.Aliases = aliases
	return f, nil
}

func (r *FornecedorRepositorio) BuscarPorID(ctx context.Context, id string) (*painel.Fornecedor, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *FornecedorRepositorio) BuscarPorNomeNormalizado(ctx context.Context, nomeNormalizado string) (*painel.Fornecedor, error) {
	// SQLite não tem função de normalização acentos/maiúsculas embutida — comparação feita
	// em Go depois de trazer os candidatos seria ineficiente à escala da planilha real, mas
	// o volume aqui (poucas dezenas de fornecedores) torna um scan completo perfeitamente
	// aceitável e mais simples que manter uma coluna normalizada em paralelo.
	fornecedores, err := r.Listar(ctx)
	if err != nil {
		return nil, err
	}
	for i := range fornecedores {
		if painel.NormalizarTexto(fornecedores[i].Nome) == nomeNormalizado {
			return &fornecedores[i], nil
		}
	}
	return nil, nil
}

func (r *FornecedorRepositorio) listar(ctx context.Context, somenteAtivos bool) ([]painel.Fornecedor, error) {
	consulta := `SELECT ` + colunasFornecedor + ` FROM fornecedores`
	if somenteAtivos {
		consulta += ` WHERE ativo = 1`
	}
	consulta += ` ORDER BY nome ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta)
	if err != nil {
		return nil, err
	}
	var fornecedores []painel.Fornecedor
	for linhas.Next() {
		f, err := lerFornecedor(linhas)
		if err != nil {
			linhas.Close()
			return nil, err
		}
		fornecedores = append(fornecedores, *f)
	}
	if err := linhas.Err(); err != nil {
		linhas.Close()
		return nil, err
	}
	linhas.Close()

	for i := range fornecedores {
		aliases, err := r.aliasesDe(ctx, fornecedores[i].ID)
		if err != nil {
			return nil, err
		}
		fornecedores[i].Aliases = aliases
	}
	return fornecedores, nil
}

func (r *FornecedorRepositorio) Listar(ctx context.Context) ([]painel.Fornecedor, error) {
	return r.listar(ctx, false)
}

func (r *FornecedorRepositorio) ListarAtivos(ctx context.Context) ([]painel.Fornecedor, error) {
	return r.listar(ctx, true)
}

func (r *FornecedorRepositorio) DonosDeAliases(ctx context.Context, aliases []string, excetoFornecedorID string) ([]painel.AliasDono, error) {
	if len(aliases) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(aliases))
	args := make([]any, 0, len(aliases)+1)
	for i, a := range aliases {
		placeholders[i] = "?"
		args = append(args, a)
	}
	consulta := `
		SELECT fa.alias, f.nome
		FROM fornecedor_aliases fa
		JOIN fornecedores f ON f.id = fa.fornecedor_id
		WHERE fa.alias IN (` + strings.Join(placeholders, ",") + `)`
	if excetoFornecedorID != "" {
		consulta += ` AND fa.fornecedor_id != ?`
		args = append(args, excetoFornecedorID)
	}

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var donos []painel.AliasDono
	for linhas.Next() {
		var d painel.AliasDono
		if err := linhas.Scan(&d.Alias, &d.FornecedorNome); err != nil {
			return nil, err
		}
		donos = append(donos, d)
	}
	return donos, linhas.Err()
}

func inserirAliases(ctx context.Context, tx *sql.Tx, fornecedorID string, aliases []string) error {
	for _, a := range aliases {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO fornecedor_aliases (id, alias, fornecedor_id) VALUES (?, ?, ?)`,
			uuid.NewString(), a, fornecedorID,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *FornecedorRepositorio) Criar(ctx context.Context, f *painel.Fornecedor) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO fornecedores (id, nome, telefone, ativo, criado_em) VALUES (?, ?, ?, 1, ?)`,
		id, f.Nome, f.Telefone, agora,
	); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: fornecedores.nome") {
			return painel.ErrFornecedorDuplicado
		}
		return err
	}
	if err := inserirAliases(ctx, tx, id, f.Aliases); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: fornecedor_aliases.alias") {
			return painel.ErrAliasDeOutro
		}
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	f.ID = id
	f.Ativo = true
	return nil
}

func (r *FornecedorRepositorio) Atualizar(ctx context.Context, f *painel.Fornecedor) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`UPDATE fornecedores SET nome = ?, telefone = ? WHERE id = ?`, f.Nome, f.Telefone, f.ID,
	); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: fornecedores.nome") {
			return painel.ErrFornecedorDuplicado
		}
		return err
	}
	// Substitui os aliases por completo — nunca merge incremental, ver COMPORTAMENTO.md §4.2.
	if _, err := tx.ExecContext(ctx, `DELETE FROM fornecedor_aliases WHERE fornecedor_id = ?`, f.ID); err != nil {
		return err
	}
	if err := inserirAliases(ctx, tx, f.ID, f.Aliases); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: fornecedor_aliases.alias") {
			return painel.ErrAliasDeOutro
		}
		return err
	}
	return tx.Commit()
}

func (r *FornecedorRepositorio) AtualizarAtivo(ctx context.Context, id string, ativo bool) error {
	v := 0
	if ativo {
		v = 1
	}
	_, err := r.DB.ExecContext(ctx, `UPDATE fornecedores SET ativo = ? WHERE id = ?`, v, id)
	return err
}

func (r *FornecedorRepositorio) MapaPorApelidoOuNome(ctx context.Context) (map[string]string, error) {
	mapa := map[string]string{}

	linhasF, err := r.DB.QueryContext(ctx, `SELECT id, nome FROM fornecedores`)
	if err != nil {
		return nil, err
	}
	type par struct{ id, nome string }
	var fs []par
	for linhasF.Next() {
		var p par
		if err := linhasF.Scan(&p.id, &p.nome); err != nil {
			linhasF.Close()
			return nil, err
		}
		fs = append(fs, p)
	}
	if err := linhasF.Err(); err != nil {
		linhasF.Close()
		return nil, err
	}
	linhasF.Close()
	for _, p := range fs {
		mapa[painel.NormalizarTexto(p.nome)] = p.id
	}

	linhasA, err := r.DB.QueryContext(ctx, `SELECT alias, fornecedor_id FROM fornecedor_aliases`)
	if err != nil {
		return nil, err
	}
	defer linhasA.Close()
	for linhasA.Next() {
		var alias, fid string
		if err := linhasA.Scan(&alias, &fid); err != nil {
			return nil, err
		}
		mapa[painel.NormalizarTexto(alias)] = fid
	}
	return mapa, linhasA.Err()
}
