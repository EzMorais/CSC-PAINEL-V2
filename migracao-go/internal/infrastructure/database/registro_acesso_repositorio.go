package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/identidade"
)

type RegistroAcessoRepositorio struct{ DB *sql.DB }

func NovoRegistroAcessoRepositorio(db *sql.DB) *RegistroAcessoRepositorio {
	return &RegistroAcessoRepositorio{DB: db}
}

func boolParaInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (r *RegistroAcessoRepositorio) Registrar(ctx context.Context, reg identidade.RegistroAcesso) error {
	ocorrido := reg.Ocorrido
	if ocorrido.IsZero() {
		ocorrido = time.Now()
	}
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO registros_acesso (id, email, nome, sucesso, motivo, ocorrido)
		VALUES (?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), reg.Email, reg.Nome, boolParaInt(reg.Sucesso), reg.Motivo, ocorrido.UTC().Format(time.RFC3339))
	return err
}

func (r *RegistroAcessoRepositorio) Ultimos(ctx context.Context, limite int) ([]identidade.RegistroAcesso, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT id, email, nome, sucesso, motivo, ocorrido
		FROM registros_acesso
		ORDER BY ocorrido DESC
		LIMIT ?`, limite)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var regs []identidade.RegistroAcesso
	for linhas.Next() {
		var reg identidade.RegistroAcesso
		var sucesso int
		var ocorrido string
		if err := linhas.Scan(&reg.ID, &reg.Email, &reg.Nome, &sucesso, &reg.Motivo, &ocorrido); err != nil {
			return nil, err
		}
		reg.Sucesso = sucesso != 0
		reg.Ocorrido, _ = time.Parse(time.RFC3339, ocorrido)
		regs = append(regs, reg)
	}
	return regs, linhas.Err()
}
