package financeirocompras

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/compras"
)

// Local materializa no novo livro financeiro cada recebimento conferido. A origem única
// torna a chamada segura para retentativa e elimina a importação apenas no startup.
type Local struct{ DB *sql.DB }

func Novo(db *sql.DB) *Local { return &Local{DB: db} }
func (l *Local) CriarTituloCompra(ctx context.Context, e dominio.TituloFinanceiroCompra) error {
	tx, err := l.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id string
	var valor int64
	err = tx.QueryRowContext(ctx, `SELECT id,valor_total_centavos FROM financeiro_titulos WHERE origem_modulo='COMPRAS' AND origem_tipo='RECEBIMENTO' AND origem_id=?`, e.ChaveOrigem).Scan(&id, &valor)
	if err == nil {
		if valor != e.ValorCentavos {
			return fmt.Errorf("recebimento já integrado com outro valor")
		}
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}
	if e.ValorCentavos <= 0 {
		return fmt.Errorf("valor financeiro deve ser positivo")
	}
	id = uuid.NewString()
	parcelaID := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	competencia := e.Emissao.Format("2006-01")
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_titulos(id,numero,tipo,contraparte_id,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,valor_aberto_centavos,status,origem_modulo,origem_tipo,origem_id,criado_em,atualizado_em)VALUES(?,?,'PAGAR',?,?,?,?,?,?,?,'APROVADO','COMPRAS','RECEBIMENTO',?,?,?)`, id, "FIN-"+e.Numero, e.FornecedorID, e.FornecedorNome, e.Descricao, e.Emissao.Format(time.DateOnly), competencia, e.ValorCentavos, e.ValorCentavos, e.ChaveOrigem, agora, agora)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_parcelas(id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status)VALUES(?,?,1,?,?,?,'ABERTA')`, parcelaID, id, e.Vencimento.Format(time.DateOnly), e.ValorCentavos, e.ValorCentavos)
	if err != nil {
		return err
	}
	if e.ChaveNF != nil && *e.ChaveNF != "" {
		emissaoFiscal := e.Emissao
		if e.EmissaoFiscal != nil {
			emissaoFiscal = *e.EmissaoFiscal
		}
		valorFiscal := e.ValorCentavos
		if e.ValorFiscalCentavos != nil && *e.ValorFiscalCentavos > 0 {
			valorFiscal = *e.ValorFiscalCentavos
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_documentos_fiscais(id,titulo_id,direcao,modelo,emissor,ambiente,status,contraparte_nome,numero,chave,emissao,valor_centavos,criado_em,atualizado_em) VALUES(?,?,'ENTRADA','NFE','EXTERNO','PRODUCAO','AUTORIZADO',?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, "compras-"+e.ChaveOrigem, id, e.FornecedorNome, e.NotaFiscal, e.ChaveNF, emissaoFiscal.Format(time.DateOnly), valorFiscal, agora, agora)
		if err != nil {
			return err
		}
	}
	payload := fmt.Sprintf(`{"origem":"COMPRAS","recebimentoId":%q,"tituloId":%q}`, e.ChaveOrigem, id)
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), "FINANCEIRO_TITULO_CRIADO", id, payload, agora)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// AbaterDevolucao reduz o saldo aberto do título materializado pelo recebimento.
// O abatimento é registrado na auditoria com a devolução como correlação, o que
// torna a chamada idempotente: reentregas não reduzem o mesmo título duas vezes.
func (l *Local) AbaterDevolucao(ctx context.Context, e dominio.AbatimentoDevolucao) error {
	if e.RecebimentoID == "" || e.ValorCentavos <= 0 {
		return fmt.Errorf("recebimento e valor positivo de abatimento são obrigatórios")
	}
	tx, err := l.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var tituloID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM financeiro_titulos WHERE origem_modulo='COMPRAS' AND origem_tipo='RECEBIMENTO' AND origem_id=?`, e.RecebimentoID).Scan(&tituloID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	var aplicada string
	err = tx.QueryRowContext(ctx, `SELECT id FROM financeiro_auditoria WHERE agregado_tipo='TITULO' AND agregado_id=? AND acao='ABATER_DEVOLUCAO' AND correlacao_id=?`, tituloID, e.DevolucaoID).Scan(&aplicada)
	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var abertoAtual int64
	var statusAtual string
	if err = tx.QueryRowContext(ctx, `SELECT valor_aberto_centavos,status FROM financeiro_titulos WHERE id=?`, tituloID).Scan(&abertoAtual, &statusAtual); err != nil {
		return err
	}
	if abertoAtual < e.ValorCentavos {
		return fmt.Errorf("abatimento excede o saldo aberto do título")
	}
	novoAberto := abertoAtual - e.ValorCentavos
	status := statusAtual
	if novoAberto == 0 {
		status = "LIQUIDADO"
	}
	agora := time.Now().UTC().Format(time.RFC3339)
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_titulos SET valor_aberto_centavos=?,status=?,atualizado_em=? WHERE id=?`, novoAberto, status, agora, tituloID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_parcelas SET valor_aberto_centavos=?,status=CASE WHEN ?<=0 THEN 'LIQUIDADA' ELSE status END WHERE titulo_id=? AND valor_aberto_centavos>=?`, novoAberto, novoAberto, tituloID, e.ValorCentavos); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_nome,depois_json,correlacao_id,criado_em)VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "TITULO", tituloID, "ABATER_DEVOLUCAO", e.RegistradoPor, fmt.Sprintf(`{"valorAbertoCentavos":%d,"status":%q,"devolucao":%q}`, novoAberto, status, e.DevolucaoNumero), e.DevolucaoID, agora); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), "FINANCEIRO_TITULO_ABATIDO", tituloID, fmt.Sprintf(`{"origem":"COMPRAS","recebimentoId":%q,"tituloId":%q,"devolucaoId":%q,"valorCentavos":%d}`, e.RecebimentoID, tituloID, e.DevolucaoID, e.ValorCentavos), agora)
	if err != nil {
		return err
	}
	return tx.Commit()
}
