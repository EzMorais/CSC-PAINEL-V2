package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHDocumentoRepositorio struct{ DB *sql.DB }

func NovoRHDocumentoRepositorio(db *sql.DB) *RHDocumentoRepositorio {
	return &RHDocumentoRepositorio{DB: db}
}

const colunasDocumento = `d.id, d.categoria, d.titulo, d.versao, d.vigente_desde, d.valido_ate, d.arquivo,
	d.observacao, d.registrado_por, d.criado_em, d.obra_id, d.funcionario_id`

func lerDocumento(linha interface{ Scan(...any) error }) (rh.Documento, error) {
	var d rh.Documento
	var vigenteDesde, validoAte, arquivo, observacao, registradoPor, obraID, funcionarioID sql.NullString
	var criadoEm string
	if err := linha.Scan(&d.ID, &d.Categoria, &d.Titulo, &d.Versao, &vigenteDesde, &validoAte, &arquivo,
		&observacao, &registradoPor, &criadoEm, &obraID, &funcionarioID); err != nil {
		return d, err
	}
	d.Arquivo, d.Observacao, d.RegistradoPor = txt(arquivo), txt(observacao), txt(registradoPor)
	d.ObraID, d.FuncionarioID = txt(obraID), txt(funcionarioID)
	d.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	if vigenteDesde.Valid {
		v, _ := time.Parse(time.RFC3339, vigenteDesde.String)
		d.VigenteDesde = &v
	}
	if validoAte.Valid {
		v, _ := time.Parse(time.RFC3339, validoAte.String)
		d.ValidoAte = &v
	}
	return d, nil
}

func (r *RHDocumentoRepositorio) Listar(ctx context.Context) ([]rh.DocumentoComContexto, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT `+colunasDocumento+`, f.nome, o.codigo
		FROM documentos d
		LEFT JOIN funcionarios f ON f.id = d.funcionario_id
		LEFT JOIN obras o ON o.id = d.obra_id
		ORDER BY d.criado_em DESC`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var docs []rh.DocumentoComContexto
	for linhas.Next() {
		var dc rh.DocumentoComContexto
		var vigenteDesde, validoAte, arquivo, observacao, registradoPor, obraID, funcionarioID, funcionarioNome, obraCodigo sql.NullString
		var criadoEm string
		if err := linhas.Scan(&dc.ID, &dc.Categoria, &dc.Titulo, &dc.Versao, &vigenteDesde, &validoAte, &arquivo,
			&observacao, &registradoPor, &criadoEm, &obraID, &funcionarioID, &funcionarioNome, &obraCodigo); err != nil {
			return nil, err
		}
		dc.Arquivo, dc.Observacao, dc.RegistradoPor = txt(arquivo), txt(observacao), txt(registradoPor)
		dc.ObraID, dc.FuncionarioID = txt(obraID), txt(funcionarioID)
		dc.FuncionarioNome, dc.ObraCodigo = txt(funcionarioNome), txt(obraCodigo)
		dc.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
		if vigenteDesde.Valid {
			v, _ := time.Parse(time.RFC3339, vigenteDesde.String)
			dc.VigenteDesde = &v
		}
		if validoAte.Valid {
			v, _ := time.Parse(time.RFC3339, validoAte.String)
			dc.ValidoAte = &v
		}
		docs = append(docs, dc)
	}
	return docs, linhas.Err()
}

func (r *RHDocumentoRepositorio) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]rh.Documento, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT `+colunasDocumento+` FROM documentos d WHERE d.funcionario_id = ? ORDER BY d.categoria ASC, d.versao DESC`, funcionarioID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var docs []rh.Documento
	for linhas.Next() {
		d, err := lerDocumento(linhas)
		if err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, linhas.Err()
}

func (r *RHDocumentoRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Documento, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasDocumento+` FROM documentos d WHERE d.id = ?`, id)
	d, err := lerDocumento(linha)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *RHDocumentoRepositorio) ListarVersoes(ctx context.Context, titulo, categoria string, obraID, funcionarioID *string) ([]rh.Documento, error) {
	consulta := `SELECT ` + colunasDocumento + ` FROM documentos d WHERE d.titulo = ? AND d.categoria = ?`
	args := []any{titulo, categoria}
	if funcionarioID != nil {
		consulta += ` AND d.funcionario_id = ?`
		args = append(args, *funcionarioID)
	} else {
		consulta += ` AND d.funcionario_id IS NULL`
		if obraID != nil {
			consulta += ` AND d.obra_id = ?`
			args = append(args, *obraID)
		} else {
			consulta += ` AND d.obra_id IS NULL`
		}
	}
	consulta += ` ORDER BY d.versao DESC`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var docs []rh.Documento
	for linhas.Next() {
		d, err := lerDocumento(linhas)
		if err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, linhas.Err()
}

func (r *RHDocumentoRepositorio) Criar(ctx context.Context, d *rh.Documento) error {
	id := uuid.NewString()
	agora := time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO documentos (id, categoria, titulo, versao, vigente_desde, valido_ate, arquivo, observacao, registrado_por, criado_em, obra_id, funcionario_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, d.Categoria, d.Titulo, d.Versao, rfc3339(d.VigenteDesde), rfc3339(d.ValidoAte), d.Arquivo, d.Observacao,
		d.RegistradoPor, agora.Format(time.RFC3339), d.ObraID, d.FuncionarioID,
	)
	if err != nil {
		return err
	}
	d.ID = id
	d.CriadoEm = agora
	return nil
}
