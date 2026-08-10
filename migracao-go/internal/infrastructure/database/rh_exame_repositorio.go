package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHExameRepositorio struct{ DB *sql.DB }

func NovoRHExameRepositorio(db *sql.DB) *RHExameRepositorio { return &RHExameRepositorio{DB: db} }

func (r *RHExameRepositorio) Listar(ctx context.Context) ([]rh.ExameComNome, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT e.id, e.tipo, e.realizado_em, e.validade_em, e.resultado, e.restricoes, e.arquivo,
		       e.registrado_por, e.funcionario_id, f.nome
		FROM exames e
		JOIN funcionarios f ON f.id = e.funcionario_id
		ORDER BY e.realizado_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var exames []rh.ExameComNome
	for linhas.Next() {
		var e rh.ExameComNome
		var validadeEm sql.NullString
		var restricoes, arquivo, registradoPor sql.NullString
		var realizadoEm string
		if err := linhas.Scan(&e.ID, &e.Tipo, &realizadoEm, &validadeEm, &e.Resultado, &restricoes,
			&arquivo, &registradoPor, &e.FuncionarioID, &e.FuncionarioNome); err != nil {
			return nil, err
		}
		e.Restricoes, e.Arquivo, e.RegistradoPor = txt(restricoes), txt(arquivo), txt(registradoPor)
		e.RealizadoEm, _ = time.Parse(time.RFC3339, realizadoEm)
		if validadeEm.Valid {
			v, _ := time.Parse(time.RFC3339, validadeEm.String)
			e.ValidadeEm = &v
		}
		exames = append(exames, e)
	}
	return exames, linhas.Err()
}

func (r *RHExameRepositorio) Criar(ctx context.Context, e *rh.Exame) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO exames (id, tipo, realizado_em, validade_em, resultado, restricoes, arquivo, registrado_por, funcionario_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, e.Tipo, rfc3339(&e.RealizadoEm), rfc3339(e.ValidadeEm), e.Resultado, e.Restricoes, e.Arquivo, e.RegistradoPor, e.FuncionarioID,
	)
	if err != nil {
		return err
	}
	e.ID = id
	return nil
}
