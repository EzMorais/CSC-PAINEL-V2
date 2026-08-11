package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

// txt converte sql.NullString em *string — usado em toda leitura de coluna opcional deste
// arquivo em diante (Funcionario tem muitos campos assim). nil quando NULL.
func txt(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

type RHCargoRepositorio struct{ DB *sql.DB }

func NovoRHCargoRepositorio(db *sql.DB) *RHCargoRepositorio { return &RHCargoRepositorio{DB: db} }

const colunasCargo = `id, nome, cbo, risco, descricao, responsabilidades, requisitos, documentos_obrigatorios, ativo, criado_em`

func lerCargo(linha linhaEscaneavel) (*rh.Cargo, error) {
	var c rh.Cargo
	var cbo, descricao, responsabilidades, requisitos, documentos sql.NullString
	var ativo int
	var criadoEm string
	if err := linha.Scan(&c.ID, &c.Nome, &cbo, &c.Risco, &descricao, &responsabilidades, &requisitos, &documentos, &ativo, &criadoEm); err != nil {
		return nil, err
	}
	c.CBO = txt(cbo)
	c.Descricao = txt(descricao)
	c.Responsabilidades = txt(responsabilidades)
	c.Requisitos = txt(requisitos)
	c.DocumentosObrigatorios = txt(documentos)
	c.Ativo = ativo != 0
	c.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	return &c, nil
}

func (r *RHCargoRepositorio) buscar(ctx context.Context, condicao, arg string) (*rh.Cargo, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasCargo+` FROM cargos WHERE `+condicao, arg)
	c, err := lerCargo(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *RHCargoRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Cargo, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *RHCargoRepositorio) BuscarPorNome(ctx context.Context, nome string) (*rh.Cargo, error) {
	return r.buscar(ctx, "nome = ?", nome)
}

func (r *RHCargoRepositorio) Listar(ctx context.Context) ([]rh.Cargo, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasCargo+` FROM cargos ORDER BY nome ASC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var cargos []rh.Cargo
	for linhas.Next() {
		c, err := lerCargo(linhas)
		if err != nil {
			return nil, err
		}
		cargos = append(cargos, *c)
	}
	return cargos, linhas.Err()
}

func (r *RHCargoRepositorio) Criar(ctx context.Context, c *rh.Cargo) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO cargos (id, nome, cbo, risco, descricao, responsabilidades, requisitos, documentos_obrigatorios, ativo, criado_em)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
		id, c.Nome, c.CBO, c.Risco, c.Descricao, c.Responsabilidades, c.Requisitos, c.DocumentosObrigatorios, agora)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: cargos.nome") {
			return rh.ErrCargoDuplicado
		}
		return err
	}
	c.ID = id
	c.Ativo = true
	return nil
}

func (r *RHCargoRepositorio) Atualizar(ctx context.Context, c *rh.Cargo) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE cargos SET nome = ?, cbo = ?, risco = ?, descricao = ?, responsabilidades = ?, requisitos = ?, documentos_obrigatorios = ? WHERE id = ?`,
		c.Nome, c.CBO, c.Risco, c.Descricao, c.Responsabilidades, c.Requisitos, c.DocumentosObrigatorios, c.ID)
	if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed: cargos.nome") {
		return rh.ErrCargoDuplicado
	}
	return err
}

type RHDepartamentoRepositorio struct{ DB *sql.DB }

func NovoRHDepartamentoRepositorio(db *sql.DB) *RHDepartamentoRepositorio {
	return &RHDepartamentoRepositorio{DB: db}
}

const colunasDepartamento = `id, nome, pai_id`

func lerDepartamento(linha linhaEscaneavel) (*rh.Departamento, error) {
	var d rh.Departamento
	var paiID sql.NullString
	if err := linha.Scan(&d.ID, &d.Nome, &paiID); err != nil {
		return nil, err
	}
	d.PaiID = txt(paiID)
	return &d, nil
}

func (r *RHDepartamentoRepositorio) buscar(ctx context.Context, condicao, arg string) (*rh.Departamento, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasDepartamento+` FROM departamentos WHERE `+condicao, arg)
	d, err := lerDepartamento(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return d, err
}

func (r *RHDepartamentoRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Departamento, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *RHDepartamentoRepositorio) BuscarPorNome(ctx context.Context, nome string) (*rh.Departamento, error) {
	return r.buscar(ctx, "nome = ?", nome)
}

func (r *RHDepartamentoRepositorio) listar(ctx context.Context, soRamos bool) ([]rh.Departamento, error) {
	consulta := `SELECT ` + colunasDepartamento + ` FROM departamentos`
	if soRamos {
		consulta += ` WHERE pai_id IS NULL`
	}
	consulta += ` ORDER BY pai_id IS NOT NULL, nome ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var deps []rh.Departamento
	for linhas.Next() {
		d, err := lerDepartamento(linhas)
		if err != nil {
			return nil, err
		}
		deps = append(deps, *d)
	}
	return deps, linhas.Err()
}

func (r *RHDepartamentoRepositorio) Listar(ctx context.Context) ([]rh.Departamento, error) {
	return r.listar(ctx, false)
}

func (r *RHDepartamentoRepositorio) ListarRamos(ctx context.Context) ([]rh.Departamento, error) {
	return r.listar(ctx, true)
}

func (r *RHDepartamentoRepositorio) Criar(ctx context.Context, d *rh.Departamento) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO departamentos (id, nome, pai_id) VALUES (?, ?, ?)`,
		id, d.Nome, d.PaiID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: departamentos.nome") {
			return rh.ErrDepartamentoDuplicado
		}
		return err
	}
	d.ID = id
	return nil
}
