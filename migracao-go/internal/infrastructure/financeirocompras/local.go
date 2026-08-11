package financeirocompras

import (
	"context"
	"database/sql"
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
