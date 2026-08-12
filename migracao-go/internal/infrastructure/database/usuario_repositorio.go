package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/identidade"
)

// UsuarioRepositorio implementa identidade.UsuarioRepositorio sobre SQLite — o único
// adaptador que conhece o formato das colunas. Ver ARQUITETURA.md §1.
type UsuarioRepositorio struct{ DB *sql.DB }

func NovoUsuarioRepositorio(db *sql.DB) *UsuarioRepositorio {
	return &UsuarioRepositorio{DB: db}
}

const colunasUsuario = `id, nome, email, senha_hash, cargo, ativo, telefone, observacao, criado_em, atualizado_em, ultimo_acesso, papel_financeiro`

type linhaEscaneavel interface {
	Scan(dest ...any) error
}

func lerUsuario(linha linhaEscaneavel) (*identidade.Usuario, error) {
	var u identidade.Usuario
	var cargo string
	var papelFinanceiro string
	var ativo int
	var criadoEm, atualizadoEm string
	var ultimoAcesso sql.NullString

	if err := linha.Scan(
		&u.ID, &u.Nome, &u.Email, &u.SenhaHash, &cargo, &ativo,
		&u.Telefone, &u.Observacao, &criadoEm, &atualizadoEm, &ultimoAcesso, &papelFinanceiro,
	); err != nil {
		return nil, err
	}

	u.Cargo = identidade.Cargo(cargo)
	u.PapelFinanceiro = identidade.PapelFinanceiro(papelFinanceiro)
	u.Ativo = ativo != 0
	u.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	u.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizadoEm)
	if ultimoAcesso.Valid {
		t, _ := time.Parse(time.RFC3339, ultimoAcesso.String)
		u.UltimoAcesso = &t
	}
	return &u, nil
}

func (r *UsuarioRepositorio) buscar(ctx context.Context, condicao, arg string) (*identidade.Usuario, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasUsuario+` FROM usuarios WHERE `+condicao, arg)
	u, err := lerUsuario(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	modulos, err := r.modulosDoUsuario(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	u.Modulos = modulos
	return u, nil
}

func (r *UsuarioRepositorio) BuscarPorEmail(ctx context.Context, email string) (*identidade.Usuario, error) {
	return r.buscar(ctx, "email = ?", email)
}

func (r *UsuarioRepositorio) BuscarPorID(ctx context.Context, id string) (*identidade.Usuario, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *UsuarioRepositorio) modulosDoUsuario(ctx context.Context, id string) ([]identidade.Modulo, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT modulo FROM acessos_modulo WHERE usuario_id = ?`, id)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var modulos []identidade.Modulo
	for linhas.Next() {
		var m string
		if err := linhas.Scan(&m); err != nil {
			return nil, err
		}
		modulos = append(modulos, identidade.Modulo(m))
	}
	return modulos, linhas.Err()
}

func (r *UsuarioRepositorio) Listar(ctx context.Context) ([]identidade.Usuario, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT `+colunasUsuario+`
		FROM usuarios
		ORDER BY ativo DESC, nome ASC`)
	if err != nil {
		return nil, err
	}

	// Junta os usuários primeiro e fecha o cursor ANTES de buscar os módulos de cada um.
	// Com um pool de 1 conexão (ver conexao.go), fazer a segunda consulta com este cursor
	// ainda aberto trava: a consulta de módulos espera uma conexão livre que só se libera
	// quando este loop terminar — e este loop só termina depois da consulta de módulos.
	var usuarios []identidade.Usuario
	for linhas.Next() {
		u, err := lerUsuario(linhas)
		if err != nil {
			linhas.Close()
			return nil, err
		}
		usuarios = append(usuarios, *u)
	}
	if err := linhas.Err(); err != nil {
		linhas.Close()
		return nil, err
	}
	linhas.Close()

	for i := range usuarios {
		modulos, err := r.modulosDoUsuario(ctx, usuarios[i].ID)
		if err != nil {
			return nil, err
		}
		usuarios[i].Modulos = modulos
	}
	return usuarios, nil
}

func inserirAcessos(ctx context.Context, tx *sql.Tx, usuarioID string, modulos []identidade.Modulo) error {
	for _, m := range modulos {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO acessos_modulo (id, modulo, usuario_id) VALUES (?, ?, ?)`,
			uuid.NewString(), string(m), usuarioID,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *UsuarioRepositorio) Criar(ctx context.Context, u *identidade.Usuario, modulos []identidade.Modulo) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO usuarios (id, nome, email, senha_hash, cargo, ativo, telefone, observacao, criado_em, atualizado_em, papel_financeiro)
		VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
		id, u.Nome, u.Email, u.SenhaHash, string(u.Cargo), u.Telefone, u.Observacao, agora, agora, string(u.PapelFinanceiro))
	if err != nil {
		// Detecção pragmática por texto — o mesmo que o código Next.js original fazia
		// com `e.message.includes('Unique')` em actions/usuarios.ts.
		if strings.Contains(err.Error(), "UNIQUE constraint failed: usuarios.email") {
			return identidade.ErrEmailDuplicado
		}
		return err
	}

	if err := inserirAcessos(ctx, tx, id, modulos); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	u.ID = id
	u.Ativo = true
	return nil
}

func (r *UsuarioRepositorio) AtualizarCargoEAcessos(ctx context.Context, id string, cargo identidade.Cargo, ativo bool, modulos []identidade.Modulo, papelFinanceiro identidade.PapelFinanceiro) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	ativoInt := 0
	if ativo {
		ativoInt = 1
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE usuarios SET cargo = ?, ativo = ?, papel_financeiro = ?, atualizado_em = ? WHERE id = ?`,
		string(cargo), ativoInt, string(papelFinanceiro), time.Now().UTC().Format(time.RFC3339), id,
	); err != nil {
		return err
	}

	// Apaga e recria os acessos na mesma transação — se apagar der certo e criar falhar,
	// a pessoa ficaria sem módulo nenhum sem ninguém ter pedido isso (COMPORTAMENTO.md §5).
	if _, err := tx.ExecContext(ctx, `DELETE FROM acessos_modulo WHERE usuario_id = ?`, id); err != nil {
		return err
	}
	if err := inserirAcessos(ctx, tx, id, modulos); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *UsuarioRepositorio) AtualizarSenha(ctx context.Context, id, senhaHash string) error {
	_, err := r.DB.ExecContext(ctx,
		`UPDATE usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ?`,
		senhaHash, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func (r *UsuarioRepositorio) AtualizarUltimoAcesso(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx,
		`UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?`,
		time.Now().UTC().Format(time.RFC3339), id)
	return err
}
