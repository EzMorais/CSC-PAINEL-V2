package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
)

type FinanceiroRepositorio struct{ DB *sql.DB }

func NovoFinanceiroRepositorio(db *sql.DB) *FinanceiroRepositorio {
	return &FinanceiroRepositorio{DB: db}
}

func lerTitulo(row interface{ Scan(...any) error }) (*dominio.Titulo, error) {
	var t dominio.Titulo
	var tipo, status string
	var emissao string
	err := row.Scan(&t.ID, &t.Numero, &tipo, &t.ContraparteNome, &t.Descricao, &emissao, &t.Competencia, &t.ValorTotal, &t.ValorAberto, &status)
	t.Tipo = dominio.TipoTitulo(tipo)
	t.Status = dominio.StatusTitulo(status)
	t.Emissao, _ = time.Parse(time.DateOnly, emissao)
	return &t, err
}

const selectTitulo = `SELECT id,numero,tipo,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,valor_aberto_centavos,status FROM financeiro_titulos WHERE id=?`

func (r *FinanceiroRepositorio) BuscarTitulo(ctx context.Context, id string) (*dominio.Titulo, error) {
	t, err := lerTitulo(r.DB.QueryRowContext(ctx, selectTitulo, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.DB.QueryContext(ctx, `SELECT id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status FROM financeiro_parcelas WHERE titulo_id=? ORDER BY numero`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p dominio.Parcela
		var venc, status string
		if err := rows.Scan(&p.ID, &p.TituloID, &p.Numero, &venc, &p.ValorOriginal, &p.ValorAberto, &status); err != nil {
			return nil, err
		}
		p.Vencimento, _ = time.Parse(time.DateOnly, venc)
		p.Status = dominio.StatusParcela(status)
		t.Parcelas = append(t.Parcelas, p)
	}
	return t, rows.Err()
}

func (r *FinanceiroRepositorio) RegistrarBaixa(ctx context.Context, m dominio.Movimento) (bool, dominio.StatusTitulo, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return false, "", err
	}
	defer tx.Rollback()
	var tituloExistente, tipoExistente string
	var valorExistente dominio.Centavos
	err = tx.QueryRowContext(ctx, `SELECT titulo_id,tipo,valor_centavos FROM financeiro_movimentos WHERE chave_idempotencia=?`, m.ChaveIdempotencia).Scan(&tituloExistente, &tipoExistente, &valorExistente)
	if err == nil {
		if tituloExistente != m.TituloID || tipoExistente != m.Tipo || valorExistente != m.Valor {
			return false, "", dominio.ErrChaveConflitante
		}
		var status string
		if err = tx.QueryRowContext(ctx, `SELECT status FROM financeiro_titulos WHERE id=?`, m.TituloID).Scan(&status); err != nil {
			return false, "", err
		}
		return true, dominio.StatusTitulo(status), nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, "", err
	}
	t, err := lerTitulo(tx.QueryRowContext(ctx, selectTitulo, m.TituloID))
	if err != nil {
		return false, "", err
	}
	status, err := t.StatusAposBaixa(m.Valor)
	if err != nil {
		return false, "", err
	}
	novoAberto := t.ValorAberto - m.Valor
	agora := time.Now().UTC()
	m.ID = uuid.NewString()
	m.CriadoEm = agora
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_movimentos(id,titulo_id,parcela_id,conta_id,tipo,valor_centavos,ocorrido_em,documento,observacao,chave_idempotencia,registrado_por,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, m.ID, m.TituloID, m.ParcelaID, m.ContaID, m.Tipo, m.Valor, m.OcorridoEm.Format(time.RFC3339), m.Documento, m.Observacao, m.ChaveIdempotencia, m.RegistradoPor, agora.Format(time.RFC3339))
	if err != nil {
		return false, "", err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_titulos SET valor_aberto_centavos=?,status=?,atualizado_em=? WHERE id=?`, novoAberto, string(status), agora.Format(time.RFC3339), m.TituloID); err != nil {
		return false, "", err
	}
	if m.ParcelaID != nil {
		var aberto dominio.Centavos
		var st string
		if err = tx.QueryRowContext(ctx, `SELECT valor_aberto_centavos,status FROM financeiro_parcelas WHERE id=? AND titulo_id=?`, *m.ParcelaID, m.TituloID).Scan(&aberto, &st); err != nil {
			return false, "", err
		}
		if m.Valor > aberto {
			return false, "", dominio.ErrValorExcedeAberto
		}
		novo := aberto - m.Valor
		ps := "PARCIAL"
		if novo == 0 {
			ps = "LIQUIDADA"
		}
		if _, err = tx.ExecContext(ctx, `UPDATE financeiro_parcelas SET valor_aberto_centavos=?,status=? WHERE id=?`, novo, ps, *m.ParcelaID); err != nil {
			return false, "", err
		}
	}
	payload, _ := json.Marshal(map[string]any{"tituloId": m.TituloID, "movimentoId": m.ID, "valorCentavos": m.Valor, "status": status})
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), "FINANCEIRO_BAIXA_REGISTRADA", m.TituloID, string(payload), agora.Format(time.RFC3339)); err != nil {
		return false, "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,depois_json,correlacao_id,criado_em)VALUES(?,?,?,?,?,?,?,?,?)`, uuid.NewString(), "TITULO", m.TituloID, "REGISTRAR_BAIXA", m.RegistradoPorID, m.RegistradoPor, string(payload), m.ChaveIdempotencia, agora.Format(time.RFC3339)); err != nil {
		return false, "", err
	}
	if err := tx.Commit(); err != nil {
		return false, "", err
	}
	return false, status, nil
}

// EstornarMovimento registra um movimento inverso sem apagar ou alterar o fato
// original. O título/parcela são reabertos na mesma transação e a chave protege
// reentregas do comando de estorno.
func (r *FinanceiroRepositorio) EstornarMovimento(ctx context.Context, movimentoID, chave, observacao, registradoPorID, registradoPor string) (bool, dominio.StatusTitulo, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return false, "", err
	}
	defer tx.Rollback()
	var existenteTitulo, existenteTipo string
	var existenteValor dominio.Centavos
	var existenteOriginal sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT titulo_id,tipo,valor_centavos,movimento_original_id FROM financeiro_movimentos WHERE chave_idempotencia=?`, chave).Scan(&existenteTitulo, &existenteTipo, &existenteValor, &existenteOriginal)
	if err == nil {
		if existenteTipo != "ESTORNO" || !existenteOriginal.Valid || existenteOriginal.String != movimentoID {
			return false, "", dominio.ErrChaveConflitante
		}
		var status string
		if err = tx.QueryRowContext(ctx, `SELECT status FROM financeiro_titulos WHERE id=?`, existenteTitulo).Scan(&status); err != nil {
			return false, "", err
		}
		return true, dominio.StatusTitulo(status), nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, "", err
	}

	var tituloID, tipo, ocorrido string
	var parcelaID, contaID sql.NullString
	var valor dominio.Centavos
	if err = tx.QueryRowContext(ctx, `SELECT titulo_id,parcela_id,conta_id,tipo,valor_centavos,ocorrido_em FROM financeiro_movimentos WHERE id=?`, movimentoID).Scan(&tituloID, &parcelaID, &contaID, &tipo, &valor, &ocorrido); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, "", fmt.Errorf("movimento não encontrado")
		}
		return false, "", err
	}
	if tipo == "ESTORNO" {
		return false, "", dominio.ErrEstornoDuplicado
	}
	var jaEstornado int
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM financeiro_movimentos WHERE movimento_original_id=? AND tipo='ESTORNO'`, movimentoID).Scan(&jaEstornado); err != nil {
		return false, "", err
	}
	if jaEstornado > 0 {
		return false, "", dominio.ErrEstornoDuplicado
	}

	var total, aberto dominio.Centavos
	var status string
	if err = tx.QueryRowContext(ctx, `SELECT valor_total_centavos,valor_aberto_centavos,status FROM financeiro_titulos WHERE id=?`, tituloID).Scan(&total, &aberto, &status); err != nil {
		return false, "", err
	}
	if status == string(dominio.TituloCancelado) {
		return false, "", fmt.Errorf("título cancelado não pode ser estornado")
	}
	if aberto+valor > total {
		return false, "", fmt.Errorf("estorno excede o valor já liquidado")
	}
	agora := time.Now().UTC()
	var fechada int
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM financeiro_fechamentos WHERE competencia=? AND status='FECHADO')`, agora.Format("2006-01")).Scan(&fechada); err != nil {
		return false, "", err
	}
	if fechada != 0 {
		return false, "", dominio.ErrCompetenciaFechada
	}
	novoAberto := aberto + valor
	novoStatus := dominio.TituloParcial
	if novoAberto == total {
		novoStatus = dominio.TituloAprovado
	}
	estornoID := uuid.NewString()
	observacao = strings.TrimSpace(observacao)
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_movimentos(id,titulo_id,parcela_id,conta_id,tipo,valor_centavos,ocorrido_em,observacao,movimento_original_id,chave_idempotencia,registrado_por,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, estornoID, tituloID, nullString(parcelaID), nullString(contaID), "ESTORNO", valor, agora.Format(time.RFC3339), observacao, movimentoID, chave, registradoPor, agora.Format(time.RFC3339))
	if err != nil {
		return false, "", err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_titulos SET valor_aberto_centavos=?,status=?,atualizado_em=? WHERE id=?`, novoAberto, string(novoStatus), agora.Format(time.RFC3339), tituloID); err != nil {
		return false, "", err
	}
	if parcelaID.Valid {
		var parcelaOriginal, parcelaAberta dominio.Centavos
		if err = tx.QueryRowContext(ctx, `SELECT valor_original_centavos,valor_aberto_centavos FROM financeiro_parcelas WHERE id=? AND titulo_id=?`, parcelaID.String, tituloID).Scan(&parcelaOriginal, &parcelaAberta); err != nil {
			return false, "", err
		}
		if parcelaAberta+valor > parcelaOriginal {
			return false, "", fmt.Errorf("estorno excede o saldo original da parcela")
		}
		parcelaAberta += valor
		parcelaStatus := string(dominio.ParcelaParcial)
		if parcelaAberta == parcelaOriginal {
			parcelaStatus = string(dominio.ParcelaAberta)
		}
		if _, err = tx.ExecContext(ctx, `UPDATE financeiro_parcelas SET valor_aberto_centavos=?,status=? WHERE id=?`, parcelaAberta, parcelaStatus, parcelaID.String); err != nil {
			return false, "", err
		}
	}
	payload, _ := json.Marshal(map[string]any{"tituloId": tituloID, "movimentoId": estornoID, "movimentoOriginalId": movimentoID, "valorCentavos": valor, "status": novoStatus, "ocorridoOriginal": ocorrido})
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), "FINANCEIRO_ESTORNO_REGISTRADO", tituloID, string(payload), agora.Format(time.RFC3339)); err != nil {
		return false, "", err
	}
	antes := fmt.Sprintf(`{"status":%q,"valorAberto":%d}`, status, aberto)
	depois := fmt.Sprintf(`{"status":%q,"valorAberto":%d,"movimentoOriginalId":%q}`, novoStatus, novoAberto, movimentoID)
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,antes_json,depois_json,correlacao_id,criado_em)VALUES(?,?,?,?,?,?,?,?,?,?)`, uuid.NewString(), "TITULO", tituloID, "ESTORNAR_MOVIMENTO", registradoPorID, registradoPor, antes, depois, chave, agora.Format(time.RFC3339)); err != nil {
		return false, "", err
	}
	if err = tx.Commit(); err != nil {
		return false, "", err
	}
	return false, novoStatus, nil
}

func nullString(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}
