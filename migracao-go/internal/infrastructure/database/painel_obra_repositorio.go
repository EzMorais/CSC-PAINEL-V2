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

type ObraRepositorio struct{ DB *sql.DB }

func NovoObraRepositorio(db *sql.DB) *ObraRepositorio { return &ObraRepositorio{DB: db} }

const colunasObra = `id, cliente, codigo, descricao, responsavel, aba_origem, ativa, criado_em`

func lerObra(linha linhaEscaneavel) (*painel.Obra, error) {
	var o painel.Obra
	var ativa int
	var criadoEm string
	if err := linha.Scan(&o.ID, &o.Cliente, &o.Codigo, &o.Descricao, &o.Responsavel, &o.AbaOrigem, &ativa, &criadoEm); err != nil {
		return nil, err
	}
	o.Ativa = ativa != 0
	o.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	return &o, nil
}

func (r *ObraRepositorio) buscar(ctx context.Context, condicao, arg string) (*painel.Obra, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasObra+` FROM obras WHERE `+condicao, arg)
	o, err := lerObra(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return o, err
}

func (r *ObraRepositorio) BuscarPorID(ctx context.Context, id string) (*painel.Obra, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *ObraRepositorio) BuscarPorCodigo(ctx context.Context, codigo string) (*painel.Obra, error) {
	return r.buscar(ctx, "codigo = ?", codigo)
}

func (r *ObraRepositorio) listar(ctx context.Context, somenteAtivas bool) ([]painel.Obra, error) {
	consulta := `SELECT ` + colunasObra + ` FROM obras`
	if somenteAtivas {
		consulta += ` WHERE ativa = 1`
	}
	consulta += ` ORDER BY cliente ASC, codigo ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var obras []painel.Obra
	for linhas.Next() {
		o, err := lerObra(linhas)
		if err != nil {
			return nil, err
		}
		obras = append(obras, *o)
	}
	return obras, linhas.Err()
}

func (r *ObraRepositorio) Listar(ctx context.Context) ([]painel.Obra, error) {
	return r.listar(ctx, false)
}

func (r *ObraRepositorio) ListarAtivas(ctx context.Context) ([]painel.Obra, error) {
	return r.listar(ctx, true)
}

func (r *ObraRepositorio) Criar(ctx context.Context, o *painel.Obra) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO obras (id, cliente, codigo, descricao, responsavel, aba_origem, ativa, criado_em)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
		id, o.Cliente, o.Codigo, o.Descricao, o.Responsavel, o.AbaOrigem, agora)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: obras.codigo") {
			return painel.ErrCodigoObraDuplicado
		}
		return err
	}
	o.ID = id
	o.Ativa = true
	return nil
}

func (r *ObraRepositorio) Atualizar(ctx context.Context, o *painel.Obra) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE obras SET cliente = ?, codigo = ?, descricao = ?, responsavel = ? WHERE id = ?`,
		o.Cliente, o.Codigo, o.Descricao, o.Responsavel, o.ID)
	if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed: obras.codigo") {
		return painel.ErrCodigoObraDuplicado
	}
	return err
}

func (r *ObraRepositorio) AtualizarAtiva(ctx context.Context, id string, ativa bool) error {
	v := 0
	if ativa {
		v = 1
	}
	_, err := r.DB.ExecContext(ctx, `UPDATE obras SET ativa = ? WHERE id = ?`, v, id)
	return err
}

func (r *ObraRepositorio) ContarLocacoesEmAberto(ctx context.Context, obraID string) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM locacoes WHERE obra_id = ? AND devolvida_em IS NULL`, obraID,
	).Scan(&n)
	return n, err
}
