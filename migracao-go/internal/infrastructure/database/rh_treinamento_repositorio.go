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

type RHTreinamentoRepositorio struct{ DB *sql.DB }

func NovoRHTreinamentoRepositorio(db *sql.DB) *RHTreinamentoRepositorio {
	return &RHTreinamentoRepositorio{DB: db}
}

const colunasTreinamento = `id, norma, descricao, instrutor, carga_horaria, realizado_em, validade_em`

func lerTreinamento(linha linhaEscaneavel) (*rh.Treinamento, error) {
	var t rh.Treinamento
	var instrutor sql.NullString
	var cargaHoraria sql.NullFloat64
	var realizadoEm string
	var validadeEm sql.NullString
	if err := linha.Scan(&t.ID, &t.Norma, &t.Descricao, &instrutor, &cargaHoraria, &realizadoEm, &validadeEm); err != nil {
		return nil, err
	}
	t.Instrutor = txt(instrutor)
	if cargaHoraria.Valid {
		t.CargaHoraria = &cargaHoraria.Float64
	}
	t.RealizadoEm, _ = time.Parse(time.RFC3339, realizadoEm)
	t.ValidadeEm = parseRFC3339Ptr(validadeEm)
	return &t, nil
}

func (r *RHTreinamentoRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Treinamento, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasTreinamento+` FROM treinamentos WHERE id = ?`, id)
	t, err := lerTreinamento(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return t, err
}

func (r *RHTreinamentoRepositorio) Listar(ctx context.Context, busca string) ([]rh.Treinamento, error) {
	consulta := `SELECT ` + colunasTreinamento + ` FROM treinamentos WHERE 1=1`
	var args []any
	if busca = strings.TrimSpace(busca); busca != "" {
		consulta += ` AND descricao LIKE ?`
		args = append(args, "%"+busca+"%")
	}
	consulta += ` ORDER BY realizado_em DESC`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var ts []rh.Treinamento
	for linhas.Next() {
		t, err := lerTreinamento(linhas)
		if err != nil {
			return nil, err
		}
		ts = append(ts, *t)
	}
	return ts, linhas.Err()
}

func (r *RHTreinamentoRepositorio) Criar(ctx context.Context, t *rh.Treinamento) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO treinamentos (id, norma, descricao, instrutor, carga_horaria, realizado_em, validade_em)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, t.Norma, t.Descricao, t.Instrutor, t.CargaHoraria, rfc3339(&t.RealizadoEm), rfc3339(t.ValidadeEm),
	)
	if err != nil {
		return err
	}
	t.ID = id
	return nil
}

func (r *RHTreinamentoRepositorio) ListarParticipantes(ctx context.Context, treinamentoID string) ([]rh.ParticipanteComNome, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT tp.id, tp.certificado, tp.treinamento_id, tp.funcionario_id, f.nome
		FROM treinamento_participantes tp
		JOIN funcionarios f ON f.id = tp.funcionario_id
		WHERE tp.treinamento_id = ?
		ORDER BY f.nome ASC`, treinamentoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var participantes []rh.ParticipanteComNome
	for linhas.Next() {
		var p rh.ParticipanteComNome
		var certificado sql.NullString
		if err := linhas.Scan(&p.ID, &certificado, &p.TreinamentoID, &p.FuncionarioID, &p.FuncionarioNome); err != nil {
			return nil, err
		}
		p.Certificado = txt(certificado)
		participantes = append(participantes, p)
	}
	return participantes, linhas.Err()
}

func (r *RHTreinamentoRepositorio) AdicionarParticipante(ctx context.Context, p *rh.TreinamentoParticipante) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO treinamento_participantes (id, certificado, treinamento_id, funcionario_id)
		VALUES (?, ?, ?, ?)`,
		id, p.Certificado, p.TreinamentoID, p.FuncionarioID,
	)
	if err != nil {
		return err
	}
	p.ID = id
	return nil
}

// ListarElegiveisParaTurma — não DESLIGADO e ainda não participante desta turma.
// COMPORTAMENTO.md §2.
func (r *RHTreinamentoRepositorio) ListarElegiveisParaTurma(ctx context.Context, treinamentoID string) ([]rh.FuncionarioOpcao, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT f.id, f.nome FROM funcionarios f
		WHERE f.status != ?
		  AND f.id NOT IN (SELECT funcionario_id FROM treinamento_participantes WHERE treinamento_id = ?)
		ORDER BY f.nome ASC`, rh.StatusDesligado, treinamentoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var opcoes []rh.FuncionarioOpcao
	for linhas.Next() {
		var o rh.FuncionarioOpcao
		if err := linhas.Scan(&o.ID, &o.Nome); err != nil {
			return nil, err
		}
		opcoes = append(opcoes, o)
	}
	return opcoes, linhas.Err()
}
