package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/financeiro"
)

func textoNulo(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}

func tempoData(v sql.NullString) *time.Time {
	if !v.Valid {
		return nil
	}
	t, err := time.Parse(time.RFC3339, v.String)
	if err != nil {
		t, _ = time.Parse(time.DateOnly, v.String)
	}
	return &t
}

func proximoNumeroFinanceiro(tx *sql.Tx, tabela, coluna, prefixo string) (string, error) {
	var ultimo string
	err := tx.QueryRow(`SELECT `+coluna+` FROM `+tabela+` WHERE `+coluna+` LIKE ? ORDER BY `+coluna+` DESC LIMIT 1`, prefixo+"%").Scan(&ultimo)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	n := 1
	if ultimo != "" {
		partes := strings.Split(ultimo, "-")
		if valor, e := strconv.Atoi(partes[len(partes)-1]); e == nil {
			n = valor + 1
		}
	}
	return fmt.Sprintf("%s%04d", prefixo, n), nil
}

func (r *FinanceiroRepositorio) Resumo(ctx context.Context, hoje time.Time) (i dominio.ResumoOperacional, err error) {
	mes := hoje.Format("2006-01")
	dia := hoje.Format(time.DateOnly)
	err = r.DB.QueryRowContext(ctx, `SELECT
	 coalesce(sum(CASE WHEN t.tipo='PAGAR' AND t.status IN('APROVADO','PARCIAL') THEN t.valor_aberto_centavos ELSE 0 END),0),
	 coalesce(sum(CASE WHEN t.tipo='PAGAR' AND t.status IN('APROVADO','PARCIAL') AND p.vencimento<? THEN p.valor_aberto_centavos ELSE 0 END),0),
	 coalesce(sum(CASE WHEN t.tipo='RECEBER' AND t.status IN('APROVADO','PARCIAL') THEN t.valor_aberto_centavos ELSE 0 END),0),
	 coalesce(sum(CASE WHEN t.tipo='RECEBER' AND t.status IN('APROVADO','PARCIAL') AND p.vencimento<? THEN p.valor_aberto_centavos ELSE 0 END),0),
	 coalesce((SELECT sum(valor_liquido_centavos) FROM financeiro_faturamentos WHERE status='FATURADO' AND substr(emissao,1,7)=?),0),
	 (SELECT count(*) FROM financeiro_documentos_fiscais WHERE status='PENDENTE'),
	 (SELECT count(*) FROM financeiro_documentos_fiscais WHERE status='REJEITADO')
	 FROM financeiro_titulos t LEFT JOIN financeiro_parcelas p ON p.titulo_id=t.id AND p.numero=1`, dia, dia, mes).Scan(&i.PagarAberto, &i.PagarVencido, &i.ReceberAberto, &i.ReceberVencido, &i.FaturadoMes, &i.DocumentosPendentes, &i.DocumentosRejeitados)
	return
}

func (r *FinanceiroRepositorio) ListarTitulos(ctx context.Context, tipo dominio.TipoTitulo) ([]dominio.Titulo, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT t.id,t.numero,t.tipo,t.contraparte_nome,t.descricao,t.emissao,t.competencia,t.valor_total_centavos,t.valor_aberto_centavos,t.status,p.id,p.numero,p.vencimento,p.valor_original_centavos,p.valor_aberto_centavos,p.status FROM financeiro_titulos t LEFT JOIN financeiro_parcelas p ON p.titulo_id=t.id AND p.numero=1 WHERE t.tipo=? ORDER BY CASE WHEN p.status IN('ABERTA','PARCIAL') THEN 0 ELSE 1 END,p.vencimento,t.emissao DESC`, string(tipo))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.Titulo
	for rows.Next() {
		var t dominio.Titulo
		var tipoTexto, statusTexto, emissao string
		var parcelaID, vencimento, parcelaStatus sql.NullString
		var parcelaNumero sql.NullInt64
		var original, aberto sql.NullInt64
		if err = rows.Scan(&t.ID, &t.Numero, &tipoTexto, &t.ContraparteNome, &t.Descricao, &emissao, &t.Competencia, &t.ValorTotal, &t.ValorAberto, &statusTexto, &parcelaID, &parcelaNumero, &vencimento, &original, &aberto, &parcelaStatus); err != nil {
			return nil, err
		}
		t.Tipo, t.Status = dominio.TipoTitulo(tipoTexto), dominio.StatusTitulo(statusTexto)
		t.Emissao, _ = time.Parse(time.DateOnly, emissao)
		if parcelaID.Valid {
			p := dominio.Parcela{ID: parcelaID.String, TituloID: t.ID, Numero: int(parcelaNumero.Int64), ValorOriginal: dominio.Centavos(original.Int64), ValorAberto: dominio.Centavos(aberto.Int64), Status: dominio.StatusParcela(parcelaStatus.String)}
			p.Vencimento, _ = time.Parse(time.DateOnly, vencimento.String)
			t.Parcelas = []dominio.Parcela{p}
		}
		resultado = append(resultado, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range resultado {
		movimentos, err := r.ListarMovimentos(ctx, resultado[i].ID)
		if err != nil {
			return nil, err
		}
		resultado[i].Movimentos = movimentos
	}
	return resultado, nil
}

func (r *FinanceiroRepositorio) ListarMovimentos(ctx context.Context, tituloID string) ([]dominio.Movimento, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT id,titulo_id,parcela_id,conta_id,tipo,valor_centavos,ocorrido_em,documento,observacao,movimento_original_id,chave_idempotencia,registrado_por,criado_em FROM financeiro_movimentos WHERE titulo_id=? ORDER BY ocorrido_em,criado_em`, tituloID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.Movimento
	for rows.Next() {
		var m dominio.Movimento
		var parcelaID, contaID, documento, observacao, original, registradoPor sql.NullString
		var ocorrido, criado string
		if err := rows.Scan(&m.ID, &m.TituloID, &parcelaID, &contaID, &m.Tipo, &m.Valor, &ocorrido, &documento, &observacao, &original, &m.ChaveIdempotencia, &registradoPor, &criado); err != nil {
			return nil, err
		}
		m.ParcelaID, m.ContaID, m.Documento, m.Observacao, m.MovimentoOriginalID = textoNulo(parcelaID), textoNulo(contaID), textoNulo(documento), textoNulo(observacao), textoNulo(original)
		m.RegistradoPor = registradoPor.String
		m.OcorridoEm, _ = time.Parse(time.RFC3339, ocorrido)
		m.CriadoEm, _ = time.Parse(time.RFC3339, criado)
		resultado = append(resultado, m)
	}
	return resultado, rows.Err()
}

func (r *FinanceiroRepositorio) ListarContas(ctx context.Context) ([]dominio.ContaFinanceira, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT id,nome,tipo,moeda,ativo FROM financeiro_contas ORDER BY ativo DESC,nome`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.ContaFinanceira
	for rows.Next() {
		var c dominio.ContaFinanceira
		var ativo int
		if err = rows.Scan(&c.ID, &c.Nome, &c.Tipo, &c.Moeda, &ativo); err != nil {
			return nil, err
		}
		c.Ativo = ativo != 0
		resultado = append(resultado, c)
	}
	return resultado, rows.Err()
}

func validarCompetenciaFinanceira(competencia string) error {
	if _, err := time.Parse("2006-01", strings.TrimSpace(competencia)); err != nil || len(strings.TrimSpace(competencia)) != 7 {
		return fmt.Errorf("competência inválida; use AAAA-MM")
	}
	return nil
}

func (r *FinanceiroRepositorio) CompetenciaFechada(ctx context.Context, competencia string) (bool, error) {
	if err := validarCompetenciaFinanceira(competencia); err != nil {
		return false, err
	}
	var fechada bool
	err := r.DB.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM financeiro_fechamentos WHERE competencia=? AND status='FECHADO')`, competencia).Scan(&fechada)
	return fechada, err
}

func (r *FinanceiroRepositorio) FecharCompetencia(ctx context.Context, competencia, atorID, atorNome string) error {
	if err := validarCompetenciaFinanceira(competencia); err != nil {
		return err
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_fechamentos(id,competencia,status,fechado_em,fechado_por) VALUES(?,?, 'FECHADO',?,?) ON CONFLICT(competencia) DO UPDATE SET status='FECHADO',fechado_em=excluded.fechado_em,fechado_por=excluded.fechado_por,reaberto_em=NULL,reaberto_por=NULL`, uuid.NewString(), competencia, agora, atorID)
	if err != nil {
		return err
	}
	payload := fmt.Sprintf(`{"competencia":%q,"status":"FECHADO"}`, competencia)
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,depois_json,criado_em) VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "FECHAMENTO", competencia, "FECHAR", atorID, atorNome, payload, agora); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) ReabrirCompetencia(ctx context.Context, competencia, atorID, atorNome, justificativa string) error {
	if err := validarCompetenciaFinanceira(competencia); err != nil {
		return err
	}
	justificativa = strings.TrimSpace(justificativa)
	if justificativa == "" {
		return fmt.Errorf("justificativa é obrigatória para reabrir competência")
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	agora := time.Now().UTC().Format(time.RFC3339)
	res, err := tx.ExecContext(ctx, `UPDATE financeiro_fechamentos SET status='ABERTO',reaberto_em=?,reaberto_por=?,justificativa=? WHERE competencia=? AND status='FECHADO'`, agora, atorID, justificativa, competencia)
	if err != nil {
		return err
	}
	afetadas, _ := res.RowsAffected()
	if afetadas != 1 {
		return fmt.Errorf("competência não está fechada")
	}
	payload := fmt.Sprintf(`{"competencia":%q,"status":"ABERTO","justificativa":%q}`, competencia, justificativa)
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,justificativa,depois_json,criado_em) VALUES(?,?,?,?,?,?,?,?,?)`, uuid.NewString(), "FECHAMENTO", competencia, "REABRIR", atorID, atorNome, justificativa, payload, agora); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) ListarFechamentos(ctx context.Context) ([]dominio.Fechamento, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT competencia,status,coalesce(fechado_em,''),coalesce(fechado_por,''),coalesce(reaberto_em,''),coalesce(reaberto_por,''),coalesce(justificativa,'') FROM financeiro_fechamentos ORDER BY competencia DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.Fechamento
	for rows.Next() {
		var f dominio.Fechamento
		if err := rows.Scan(&f.Competencia, &f.Status, &f.FechadoEm, &f.FechadoPor, &f.ReabertoEm, &f.ReabertoPor, &f.Justificativa); err != nil {
			return nil, err
		}
		resultado = append(resultado, f)
	}
	return resultado, rows.Err()
}

func (r *FinanceiroRepositorio) CriarConta(ctx context.Context, c *dominio.ContaFinanceira) error {
	c.ID = uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `INSERT INTO financeiro_contas(id,nome,tipo,moeda,ativo,criado_em,atualizado_em) VALUES(?,?,?,?,1,?,?)`, c.ID, c.Nome, c.Tipo, "BRL", agora, agora)
	return err
}

func (r *FinanceiroRepositorio) CriarTituloManual(ctx context.Context, t *dominio.Titulo, vencimento time.Time, atorID, atorNome string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	prefixo := "CP-"
	if t.Tipo == dominio.TituloReceber {
		prefixo = "CR-"
	}
	prefixo += t.Emissao.Format("2006-")
	t.Numero, err = proximoNumeroFinanceiro(tx, "financeiro_titulos", "numero", prefixo)
	if err != nil {
		return err
	}
	t.ID = uuid.NewString()
	parcelaID := uuid.NewString()
	agora := time.Now().UTC()
	t.Status = dominio.TituloPendente
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_titulos(id,numero,tipo,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,valor_aberto_centavos,status,origem_modulo,origem_tipo,origem_id,criado_por,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,'FINANCEIRO','MANUAL',?,?,?,?)`, t.ID, t.Numero, string(t.Tipo), t.ContraparteNome, t.Descricao, t.Emissao.Format(time.DateOnly), t.Competencia, t.ValorTotal, t.ValorTotal, string(t.Status), t.ID, atorID, agora.Format(time.RFC3339), agora.Format(time.RFC3339))
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_parcelas(id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status) VALUES(?,?,1,?,?,?,'ABERTA')`, parcelaID, t.ID, vencimento.Format(time.DateOnly), t.ValorTotal, t.ValorTotal)
	if err != nil {
		return err
	}
	depois, _ := json.Marshal(t)
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,depois_json,criado_em) VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "TITULO", t.ID, "CRIAR", atorID, atorNome, string(depois), agora.Format(time.RFC3339))
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) AprovarTitulo(ctx context.Context, id, aprovadorID, aprovadorNome string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var criador sql.NullString
	var status string
	if err = tx.QueryRowContext(ctx, `SELECT criado_por,status FROM financeiro_titulos WHERE id=?`, id).Scan(&criador, &status); err != nil {
		return err
	}
	if status != "PENDENTE_APROVACAO" {
		return fmt.Errorf("título não aguarda aprovação")
	}
	if criador.Valid && criador.String == aprovadorID {
		return fmt.Errorf("quem lançou não pode aprovar o próprio título")
	}
	agora := time.Now().UTC().Format(time.RFC3339)
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_titulos SET status='APROVADO',atualizado_em=? WHERE id=?`, agora, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,depois_json,criado_em) VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "TITULO", id, "APROVAR", aprovadorID, aprovadorNome, `{"status":"APROVADO"}`, agora); err != nil {
		return err
	}
	return tx.Commit()
}

func scanFaturamento(row interface{ Scan(...any) error }) (*dominio.Faturamento, error) {
	var f dominio.Faturamento
	var clienteID, tituloID, observacao sql.NullString
	var emissao, vencimento, criado, atualizado string
	err := row.Scan(&f.ID, &f.Numero, &clienteID, &f.ClienteNome, &f.Descricao, &f.TipoOperacao, &emissao, &vencimento, &f.ValorBruto, &f.Desconto, &f.Acrescimo, &f.ValorLiquido, &f.ModeloFiscal, &f.EmissorFiscal, &f.Status, &tituloID, &f.ChaveIdempotencia, &observacao, &f.CriadoPorID, &f.CriadoPorNome, &criado, &atualizado)
	if err != nil {
		return nil, err
	}
	f.ClienteID, f.TituloID, f.Observacao = textoNulo(clienteID), textoNulo(tituloID), textoNulo(observacao)
	f.Emissao, _ = time.Parse(time.DateOnly, emissao)
	f.Vencimento, _ = time.Parse(time.DateOnly, vencimento)
	f.CriadoEm, _ = time.Parse(time.RFC3339, criado)
	f.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizado)
	return &f, nil
}

const colunasFaturamento = `id,numero,cliente_id,cliente_nome,descricao,tipo_operacao,emissao,vencimento,valor_bruto_centavos,desconto_centavos,acrescimo_centavos,valor_liquido_centavos,modelo_fiscal,emissor_fiscal,status,titulo_id,chave_idempotencia,observacao,coalesce(criado_por_id,''),criado_por_nome,criado_em,atualizado_em`

func (r *FinanceiroRepositorio) ListarFaturamentos(ctx context.Context) ([]dominio.Faturamento, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT `+colunasFaturamento+` FROM financeiro_faturamentos ORDER BY emissao DESC,numero DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.Faturamento
	for rows.Next() {
		f, e := scanFaturamento(rows)
		if e != nil {
			return nil, e
		}
		resultado = append(resultado, *f)
	}
	return resultado, rows.Err()
}
func (r *FinanceiroRepositorio) BuscarFaturamento(ctx context.Context, id string) (*dominio.Faturamento, error) {
	f, err := scanFaturamento(r.DB.QueryRowContext(ctx, `SELECT `+colunasFaturamento+` FROM financeiro_faturamentos WHERE id=?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return f, err
}

func (r *FinanceiroRepositorio) CriarFaturamento(ctx context.Context, f *dominio.Faturamento) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var existente, cliente, emissao, vencimento, modelo string
	var valor dominio.Centavos
	err = tx.QueryRowContext(ctx, `SELECT id,cliente_nome,emissao,vencimento,valor_liquido_centavos,modelo_fiscal FROM financeiro_faturamentos WHERE chave_idempotencia=?`, f.ChaveIdempotencia).Scan(&existente, &cliente, &emissao, &vencimento, &valor, &modelo)
	if err == nil {
		if cliente != f.ClienteNome || emissao != f.Emissao.Format(time.DateOnly) || vencimento != f.Vencimento.Format(time.DateOnly) || valor != f.ValorLiquido || modelo != f.ModeloFiscal {
			return fmt.Errorf("chave de idempotência já usada em outro faturamento")
		}
		f.ID = existente
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	f.Numero, err = proximoNumeroFinanceiro(tx, "financeiro_faturamentos", "numero", "FAT-"+f.Emissao.Format("2006-"))
	if err != nil {
		return err
	}
	f.ID = uuid.NewString()
	f.Status = "RASCUNHO"
	agora := time.Now().UTC()
	f.CriadoEm, f.AtualizadoEm = agora, agora
	_, err = tx.ExecContext(ctx, `INSERT INTO financeiro_faturamentos(id,numero,cliente_id,cliente_nome,descricao,tipo_operacao,emissao,vencimento,valor_bruto_centavos,desconto_centavos,acrescimo_centavos,valor_liquido_centavos,modelo_fiscal,emissor_fiscal,status,chave_idempotencia,observacao,criado_por_id,criado_por_nome,criado_em,atualizado_em)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, f.ID, f.Numero, f.ClienteID, f.ClienteNome, f.Descricao, f.TipoOperacao, f.Emissao.Format(time.DateOnly), f.Vencimento.Format(time.DateOnly), f.ValorBruto, f.Desconto, f.Acrescimo, f.ValorLiquido, f.ModeloFiscal, f.EmissorFiscal, f.Status, f.ChaveIdempotencia, f.Observacao, f.CriadoPorID, f.CriadoPorNome, agora.Format(time.RFC3339), agora.Format(time.RFC3339))
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) finalizarFaturamentoTx(tx *sql.Tx, f *dominio.Faturamento, atorID, atorNome string, documento *dominio.DocumentoFiscal) error {
	agora := time.Now().UTC()
	tituloID := uuid.NewString()
	parcelaID := uuid.NewString()
	numeroTitulo, err := proximoNumeroFinanceiro(tx, "financeiro_titulos", "numero", "CR-"+f.Emissao.Format("2006-"))
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO financeiro_titulos(id,numero,tipo,contraparte_id,contraparte_nome,descricao,emissao,competencia,valor_total_centavos,valor_aberto_centavos,status,origem_modulo,origem_tipo,origem_id,criado_por,criado_em,atualizado_em)VALUES(?,?,'RECEBER',?,?,?,?,?,?,?,'APROVADO','FATURAMENTO','VENDA',?,?,?,?)`, tituloID, numeroTitulo, f.ClienteID, f.ClienteNome, f.Descricao, f.Emissao.Format(time.DateOnly), f.Emissao.Format("2006-01"), f.ValorLiquido, f.ValorLiquido, f.ID, atorID, agora.Format(time.RFC3339), agora.Format(time.RFC3339))
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO financeiro_parcelas(id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status)VALUES(?,?,1,?,?,?,'ABERTA')`, parcelaID, tituloID, f.Vencimento.Format(time.DateOnly), f.ValorLiquido, f.ValorLiquido)
	if err != nil {
		return err
	}
	if documento != nil {
		documento.ID = uuid.NewString()
		documento.FaturamentoID = &f.ID
		documento.TituloID = &tituloID
		documento.CriadoEm = agora
		documento.AtualizadoEm = agora
		_, err = tx.Exec(`INSERT INTO financeiro_documentos_fiscais(id,faturamento_id,titulo_id,direcao,modelo,emissor,ambiente,status,contraparte_nome,numero,serie,chave,protocolo,emissao,valor_centavos,xml_conteudo,ultimo_erro,tentativas,autorizado_em,criado_em,atualizado_em)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, documento.ID, documento.FaturamentoID, documento.TituloID, documento.Direcao, documento.Modelo, documento.Emissor, documento.Ambiente, documento.Status, documento.ContraparteNome, documento.Numero, documento.Serie, documento.Chave, documento.Protocolo, documento.Emissao.Format(time.DateOnly), documento.Valor, documento.XMLConteudo, documento.UltimoErro, documento.Tentativas, func() any {
			if documento.AutorizadoEm != nil {
				return documento.AutorizadoEm.Format(time.RFC3339)
			}
			return nil
		}(), agora.Format(time.RFC3339), agora.Format(time.RFC3339))
		if err != nil {
			return err
		}
		payload, _ := json.Marshal(map[string]any{"documentoFiscalId": documento.ID, "faturamentoId": f.ID, "modelo": documento.Modelo, "emissor": documento.Emissor})
		tipoEvento := "FISCAL_DOCUMENTO_IMPORTADO"
		if documento.Status == "PENDENTE" {
			tipoEvento = "FISCAL_EMISSAO_SOLICITADA"
		}
		_, err = tx.Exec(`INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), tipoEvento, documento.ID, string(payload), agora.Format(time.RFC3339))
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(`UPDATE financeiro_faturamentos SET status='FATURADO',titulo_id=?,atualizado_em=? WHERE id=? AND status='RASCUNHO'`, tituloID, agora.Format(time.RFC3339), f.ID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,depois_json,criado_em)VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "FATURAMENTO", f.ID, "FATURAR", atorID, atorNome, fmt.Sprintf(`{"tituloId":%q}`, tituloID), agora.Format(time.RFC3339))
	return err
}

func (r *FinanceiroRepositorio) FinalizarFaturamento(ctx context.Context, id, atorID, atorNome string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	f, err := scanFaturamento(tx.QueryRowContext(ctx, `SELECT `+colunasFaturamento+` FROM financeiro_faturamentos WHERE id=?`, id))
	if err != nil {
		return err
	}
	if f.Status != "RASCUNHO" {
		return fmt.Errorf("faturamento já finalizado")
	}
	var doc *dominio.DocumentoFiscal
	if f.ModeloFiscal != "SEM_NOTA" {
		doc = &dominio.DocumentoFiscal{Direcao: "SAIDA", Modelo: f.ModeloFiscal, Emissor: f.EmissorFiscal, Ambiente: "HOMOLOGACAO", Status: "PENDENTE", ContraparteNome: f.ClienteNome, Emissao: f.Emissao, Valor: f.ValorLiquido}
	}
	if err = r.finalizarFaturamentoTx(tx, f, atorID, atorNome, doc); err != nil {
		return err
	}
	return tx.Commit()
}

func scanDocumentoFiscal(row interface{ Scan(...any) error }) (*dominio.DocumentoFiscal, error) {
	var d dominio.DocumentoFiscal
	var fat, tit, num, serie, chave, protocolo, xmlTexto, ultimo, autorizado, cancelado sql.NullString
	var emissao, criado, atualizado string
	err := row.Scan(&d.ID, &fat, &tit, &d.Direcao, &d.Modelo, &d.Emissor, &d.Ambiente, &d.Status, &d.ContraparteNome, &num, &serie, &chave, &protocolo, &emissao, &d.Valor, &xmlTexto, &ultimo, &d.Tentativas, &autorizado, &cancelado, &criado, &atualizado)
	if err != nil {
		return nil, err
	}
	d.FaturamentoID, d.TituloID, d.Numero, d.Serie, d.Chave, d.Protocolo, d.XMLConteudo, d.UltimoErro = textoNulo(fat), textoNulo(tit), textoNulo(num), textoNulo(serie), textoNulo(chave), textoNulo(protocolo), textoNulo(xmlTexto), textoNulo(ultimo)
	d.Emissao, _ = time.Parse(time.DateOnly, emissao)
	d.AutorizadoEm = tempoData(autorizado)
	d.CanceladoEm = tempoData(cancelado)
	d.CriadoEm, _ = time.Parse(time.RFC3339, criado)
	d.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizado)
	return &d, nil
}

const colunasDocumentoFiscal = `id,faturamento_id,titulo_id,direcao,modelo,emissor,ambiente,status,contraparte_nome,numero,serie,chave,protocolo,emissao,valor_centavos,xml_conteudo,ultimo_erro,tentativas,autorizado_em,cancelado_em,criado_em,atualizado_em`

func (r *FinanceiroRepositorio) ListarDocumentosFiscais(ctx context.Context) ([]dominio.DocumentoFiscal, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT `+colunasDocumentoFiscal+` FROM financeiro_documentos_fiscais ORDER BY emissao DESC,criado_em DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.DocumentoFiscal
	for rows.Next() {
		d, e := scanDocumentoFiscal(rows)
		if e != nil {
			return nil, e
		}
		resultado = append(resultado, *d)
	}
	return resultado, rows.Err()
}

func (r *FinanceiroRepositorio) ImportarDocumentoLegado(ctx context.Context, f *dominio.Faturamento, d *dominio.DocumentoFiscal) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var existente, contraparte string
	var valorExistente dominio.Centavos
	err = tx.QueryRow(`SELECT id,contraparte_nome,valor_centavos FROM financeiro_documentos_fiscais WHERE chave=?`, d.Chave).Scan(&existente, &contraparte, &valorExistente)
	if err == nil {
		if contraparte != d.ContraparteNome || valorExistente != d.Valor {
			return fmt.Errorf("chave fiscal já importada com outros dados")
		}
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	f.Numero, err = proximoNumeroFinanceiro(tx, "financeiro_faturamentos", "numero", "FAT-"+f.Emissao.Format("2006-"))
	if err != nil {
		return err
	}
	f.ID = uuid.NewString()
	f.Status = "RASCUNHO"
	agora := time.Now().UTC()
	f.CriadoEm, f.AtualizadoEm = agora, agora
	_, err = tx.Exec(`INSERT INTO financeiro_faturamentos(id,numero,cliente_nome,descricao,tipo_operacao,emissao,vencimento,valor_bruto_centavos,desconto_centavos,acrescimo_centavos,valor_liquido_centavos,modelo_fiscal,emissor_fiscal,status,chave_idempotencia,observacao,criado_por_id,criado_por_nome,criado_em,atualizado_em)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, f.ID, f.Numero, f.ClienteNome, f.Descricao, f.TipoOperacao, f.Emissao.Format(time.DateOnly), f.Vencimento.Format(time.DateOnly), f.ValorBruto, f.Desconto, f.Acrescimo, f.ValorLiquido, f.ModeloFiscal, f.EmissorFiscal, f.Status, f.ChaveIdempotencia, f.Observacao, f.CriadoPorID, f.CriadoPorNome, agora.Format(time.RFC3339), agora.Format(time.RFC3339))
	if err != nil {
		return err
	}
	if err = r.finalizarFaturamentoTx(tx, f, f.CriadoPorID, f.CriadoPorNome, d); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) RegistrarResultadoFiscal(ctx context.Context, id, status, chave, protocolo, xmlTexto, erroTexto, atorID, atorNome string) error {
	status = strings.ToUpper(status)
	if status != "AUTORIZADO" && status != "REJEITADO" && status != "CANCELADO" {
		return fmt.Errorf("resultado fiscal inválido")
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var atual string
	if err = tx.QueryRowContext(ctx, `SELECT status FROM financeiro_documentos_fiscais WHERE id=?`, id).Scan(&atual); err != nil {
		return err
	}
	if atual == "CANCELADO" || (atual == "AUTORIZADO" && status != "CANCELADO") || (atual != "AUTORIZADO" && status == "CANCELADO") {
		return fmt.Errorf("transição fiscal inválida: %s para %s", atual, status)
	}
	agora := time.Now().UTC()
	var autorizado, cancelado any
	if status == "AUTORIZADO" {
		autorizado = agora.Format(time.RFC3339)
	}
	if status == "CANCELADO" {
		cancelado = agora.Format(time.RFC3339)
	}
	res, err := tx.ExecContext(ctx, `UPDATE financeiro_documentos_fiscais SET status=?,chave=coalesce(nullif(?,''),chave),protocolo=coalesce(nullif(?,''),protocolo),xml_conteudo=coalesce(nullif(?,''),xml_conteudo),ultimo_erro=nullif(?,''),tentativas=tentativas+1,autorizado_em=coalesce(?,autorizado_em),cancelado_em=coalesce(?,cancelado_em),atualizado_em=? WHERE id=?`, status, chave, protocolo, xmlTexto, erroTexto, autorizado, cancelado, agora.Format(time.RFC3339), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return fmt.Errorf("documento fiscal não pode receber esse resultado")
	}
	payload, _ := json.Marshal(map[string]any{"status": status, "chave": chave, "protocolo": protocolo, "erro": erroTexto})
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_auditoria(id,agregado_tipo,agregado_id,acao,ator_id,ator_nome,antes_json,depois_json,criado_em)VALUES(?,?,?,?,?,?,?,?,?)`, uuid.NewString(), "DOCUMENTO_FISCAL", id, "REGISTRAR_RESULTADO", atorID, atorNome, fmt.Sprintf(`{"status":%q}`, atual), string(payload), agora.Format(time.RFC3339)); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em)VALUES(?,?,?,?,?)`, uuid.NewString(), "FISCAL_RESULTADO_REGISTRADO", id, string(payload), agora.Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceiroRepositorio) ListarIntegracoesFiscais(ctx context.Context) ([]dominio.IntegracaoFiscal, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT provedor,rotulo,ativo,ambiente FROM financeiro_integracoes_fiscais ORDER BY rotulo`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.IntegracaoFiscal
	for rows.Next() {
		var i dominio.IntegracaoFiscal
		var ativo int
		if err = rows.Scan(&i.Provedor, &i.Rotulo, &ativo, &i.Ambiente); err != nil {
			return nil, err
		}
		i.Ativo = ativo != 0
		out = append(out, i)
	}
	return out, rows.Err()
}
