package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/compras"
)

type ComprasProcessoRepositorio struct{ DB *sql.DB }

func NovoComprasProcessoRepositorio(db *sql.DB) *ComprasProcessoRepositorio {
	return &ComprasProcessoRepositorio{DB: db}
}
func dataNula(v sql.NullString) *time.Time {
	if !v.Valid {
		return nil
	}
	t, _ := time.Parse(time.DateOnly, v.String)
	if t.IsZero() {
		t, _ = time.Parse(time.RFC3339, v.String)
	}
	return &t
}
func (r *ComprasProcessoRepositorio) UltimoNumeroCotacao(ctx context.Context, prefixo string) (string, error) {
	var n string
	e := r.DB.QueryRowContext(ctx, `SELECT numero FROM compras_cotacoes WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`, prefixo+"%").Scan(&n)
	if errors.Is(e, sql.ErrNoRows) {
		return "", nil
	}
	return n, e
}
func (r *ComprasProcessoRepositorio) CriarCotacao(ctx context.Context, c *dominio.Cotacao, fornecedores []string) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	c.ID = uuid.NewString()
	agora := c.CriadoEm.Format(time.RFC3339)
	if _, e = tx.ExecContext(ctx, `INSERT INTO compras_cotacoes(id,numero,solicitacao_id,status,prazo_resposta,observacao,solicitante_id,solicitante_nome,criado_em)VALUES(?,?,?,?,?,?,?,?,?)`, c.ID, c.Numero, c.SolicitacaoID, string(c.Status), rfc3339(c.PrazoResposta), c.Observacao, c.SolicitanteID, c.SolicitanteNome, agora); e != nil {
		return e
	}
	for _, f := range fornecedores {
		if _, e = tx.ExecContext(ctx, `INSERT INTO compras_cotacao_fornecedores(cotacao_id,fornecedor_id,convidado_em)VALUES(?,?,?)`, c.ID, f, agora); e != nil {
			return e
		}
	}
	_, e = tx.ExecContext(ctx, `INSERT INTO compras_eventos(id,agregado_tipo,agregado_id,tipo,ator_id,ator_nome,criado_em)VALUES(?,?,?,?,?,?,?)`, uuid.NewString(), "COTACAO", c.ID, "CRIADA", c.SolicitanteID, c.SolicitanteNome, agora)
	if e != nil {
		return e
	}
	return tx.Commit()
}
func lerCotacao(row linhaEscaneavel) (*dominio.Cotacao, error) {
	var c dominio.Cotacao
	var status, prazo, obs, criado, enc sql.NullString
	e := row.Scan(&c.ID, &c.Numero, &c.SolicitacaoID, &status, &prazo, &obs, &c.SolicitanteID, &c.SolicitanteNome, &criado, &enc)
	c.Status = dominio.StatusCotacao(status.String)
	c.PrazoResposta = dataNula(prazo)
	c.Observacao = txt(obs)
	if criado.Valid {
		c.CriadoEm, _ = time.Parse(time.RFC3339, criado.String)
	}
	c.EncerradoEm = dataNula(enc)
	return &c, e
}

const selCotacao = `SELECT id,numero,solicitacao_id,status,prazo_resposta,observacao,solicitante_id,solicitante_nome,criado_em,encerrado_em FROM compras_cotacoes`

func (r *ComprasProcessoRepositorio) BuscarCotacao(ctx context.Context, id string) (*dominio.Cotacao, error) {
	c, e := lerCotacao(r.DB.QueryRowContext(ctx, selCotacao+` WHERE id=?`, id))
	if errors.Is(e, sql.ErrNoRows) {
		return nil, nil
	}
	if e != nil {
		return nil, e
	}
	fs, e := r.DB.QueryContext(ctx, `SELECT cf.fornecedor_id,f.nome,cf.convidado_em,cf.respondeu_em FROM compras_cotacao_fornecedores cf JOIN fornecedores f ON f.id=cf.fornecedor_id WHERE cf.cotacao_id=? ORDER BY f.nome`, id)
	if e != nil {
		return nil, e
	}
	for fs.Next() {
		var f dominio.FornecedorCotacao
		var conv string
		var resp sql.NullString
		if e = fs.Scan(&f.FornecedorID, &f.FornecedorNome, &conv, &resp); e != nil {
			fs.Close()
			return nil, e
		}
		f.ConvidadoEm, _ = time.Parse(time.RFC3339, conv)
		f.RespondeuEm = dataNula(resp)
		c.Fornecedores = append(c.Fornecedores, f)
	}
	fs.Close()
	ps, e := r.DB.QueryContext(ctx, `SELECT id,cotacao_id,fornecedor_id,fornecedor_nome,valor_itens_centavos,frete_centavos,total_centavos,prazo_dias,previsao_entrega,condicao_pagamento,validade,observacao,anexo,selecionada,registrado_por,criado_em FROM compras_propostas WHERE cotacao_id=? ORDER BY total_centavos`, id)
	if e != nil {
		return nil, e
	}
	for ps.Next() {
		p, e := scanProposta(ps)
		if e != nil {
			ps.Close()
			return nil, e
		}
		c.Propostas = append(c.Propostas, *p)
	}
	if e = ps.Err(); e != nil {
		ps.Close()
		return nil, e
	}
	ps.Close()
	// A conexão SQLite é deliberadamente única. Consultas filhas só começam depois de
	// fechar o cursor pai, ou o pool aguardaria a própria conexão indefinidamente.
	for i := range c.Propostas {
		c.Propostas[i].Itens, e = r.itensProposta(ctx, c.Propostas[i].ID)
		if e != nil {
			return nil, e
		}
	}
	return c, nil
}
func (r *ComprasProcessoRepositorio) ListarCotacoes(ctx context.Context) ([]dominio.Cotacao, error) {
	rows, e := r.DB.QueryContext(ctx, selCotacao+` ORDER BY criado_em DESC`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Cotacao
	for rows.Next() {
		c, e := lerCotacao(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}
func scanProposta(row linhaEscaneavel) (*dominio.Proposta, error) {
	var p dominio.Proposta
	var prazo sql.NullInt64
	var prev, cond, val, obs, an sql.NullString
	var sel int
	var cr string
	e := row.Scan(&p.ID, &p.CotacaoID, &p.FornecedorID, &p.FornecedorNome, &p.ValorItensCentavos, &p.FreteCentavos, &p.TotalCentavos, &prazo, &prev, &cond, &val, &obs, &an, &sel, &p.RegistradoPor, &cr)
	if prazo.Valid {
		n := int(prazo.Int64)
		p.PrazoDias = &n
	}
	p.PrevisaoEntrega = dataNula(prev)
	p.CondicaoPagamento = txt(cond)
	p.Validade = txt(val)
	p.Observacao = txt(obs)
	p.Anexo = txt(an)
	p.Selecionada = sel != 0
	p.CriadoEm, _ = time.Parse(time.RFC3339, cr)
	return &p, e
}
func (r *ComprasProcessoRepositorio) itensProposta(ctx context.Context, id string) ([]dominio.ItemProposta, error) {
	rows, e := r.DB.QueryContext(ctx, `SELECT id,proposta_id,material_id,quantidade,valor_unitario_centavos,marca,observacao FROM compras_proposta_itens WHERE proposta_id=?`, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.ItemProposta
	for rows.Next() {
		var i dominio.ItemProposta
		var marca, obs sql.NullString
		if e = rows.Scan(&i.ID, &i.PropostaID, &i.MaterialID, &i.Quantidade, &i.ValorUnitarioCentavos, &marca, &obs); e != nil {
			return nil, e
		}
		i.Marca = txt(marca)
		i.Observacao = txt(obs)
		out = append(out, i)
	}
	return out, rows.Err()
}
func (r *ComprasProcessoRepositorio) RegistrarProposta(ctx context.Context, p *dominio.Proposta) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	p.ID = uuid.NewString()
	agora := p.CriadoEm.Format(time.RFC3339)
	_, e = tx.ExecContext(ctx, `INSERT INTO compras_propostas(id,cotacao_id,fornecedor_id,fornecedor_nome,valor_itens_centavos,frete_centavos,total_centavos,prazo_dias,previsao_entrega,condicao_pagamento,validade,observacao,anexo,registrado_por,criado_em)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, p.ID, p.CotacaoID, p.FornecedorID, p.FornecedorNome, p.ValorItensCentavos, p.FreteCentavos, p.TotalCentavos, p.PrazoDias, rfc3339(p.PrevisaoEntrega), p.CondicaoPagamento, p.Validade, p.Observacao, p.Anexo, p.RegistradoPor, agora)
	if e != nil {
		return e
	}
	for _, i := range p.Itens {
		if _, e = tx.ExecContext(ctx, `INSERT INTO compras_proposta_itens(id,proposta_id,material_id,quantidade,valor_unitario_centavos,marca,observacao)VALUES(?,?,?,?,?,?,?)`, uuid.NewString(), p.ID, i.MaterialID, i.Quantidade, i.ValorUnitarioCentavos, i.Marca, i.Observacao); e != nil {
			return e
		}
	}
	_, e = tx.ExecContext(ctx, `UPDATE compras_cotacao_fornecedores SET respondeu_em=? WHERE cotacao_id=? AND fornecedor_id=?`, agora, p.CotacaoID, p.FornecedorID)
	if e != nil {
		return e
	}
	_, e = tx.ExecContext(ctx, `UPDATE compras_cotacoes SET status='EM_ANALISE' WHERE id=? AND status='ABERTA'`, p.CotacaoID)
	if e != nil {
		return e
	}
	return tx.Commit()
}
func (r *ComprasProcessoRepositorio) SelecionarProposta(ctx context.Context, cotacaoID, propostaID, motivo, atorID, atorNome string) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var status string
	if e = tx.QueryRowContext(ctx, `SELECT status FROM compras_cotacoes WHERE id=?`, cotacaoID).Scan(&status); e != nil {
		return e
	}
	if status == string(dominio.CotacaoSelecionada) || status == string(dominio.CotacaoCancelada) {
		return fmt.Errorf("cotação encerrada")
	}
	res, e := tx.ExecContext(ctx, `UPDATE compras_propostas SET selecionada=CASE WHEN id=? THEN 1 ELSE 0 END WHERE cotacao_id=?`, propostaID, cotacaoID)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("proposta não encontrada")
	}
	agora := time.Now().UTC().Format(time.RFC3339)
	_, e = tx.ExecContext(ctx, `UPDATE compras_cotacoes SET status='SELECIONADA',encerrado_em=? WHERE id=?`, agora, cotacaoID)
	if e != nil {
		return e
	}
	_, e = tx.ExecContext(ctx, `INSERT INTO compras_eventos(id,agregado_tipo,agregado_id,tipo,ator_id,ator_nome,detalhe,criado_em)VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "COTACAO", cotacaoID, "PROPOSTA_SELECIONADA", atorID, atorNome, motivo, agora)
	if e != nil {
		return e
	}
	return tx.Commit()
}
func (r *ComprasProcessoRepositorio) AtualizarFluxoPedido(ctx context.Context, id string, de, para dominio.StatusPedidoCompra, atorID, atorNome, detalhe string) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	agora := time.Now().UTC().Format(time.RFC3339)
	q := `UPDATE compras_pedidos SET status=?`
	args := []any{string(para)}
	switch para {
	case dominio.StatusPedidoAprovado:
		q += `,aprovador_id=?,aprovador_nome=?,aprovado_em=?`
		args = append(args, atorID, atorNome, agora)
	case dominio.StatusPedidoEnviado:
		q += `,enviado_em=?`
		args = append(args, agora)
	case dominio.StatusPedidoCancelado:
		q += `,cancelado_em=?,cancelado_por=?,motivo_cancelamento=?`
		args = append(args, agora, atorNome, detalhe)
	}
	q += ` WHERE id=? AND status=?`
	args = append(args, id, string(de))
	res, e := tx.ExecContext(ctx, q, args...)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return fmt.Errorf("pedido mudou de estado; atualize a tela")
	}
	_, e = tx.ExecContext(ctx, `INSERT INTO compras_eventos(id,agregado_tipo,agregado_id,tipo,ator_id,ator_nome,detalhe,criado_em)VALUES(?,?,?,?,?,?,?,?)`, uuid.NewString(), "PEDIDO", id, string(para), atorID, atorNome, optDB(detalhe), agora)
	if e != nil {
		return e
	}
	return tx.Commit()
}
func (r *ComprasProcessoRepositorio) AtualizarDadosPedido(ctx context.Context, p *dominio.PedidoCompra) error {
	res, e := r.DB.ExecContext(ctx, `UPDATE compras_pedidos SET fornecedor_id=?,fornecedor_nome=?,observacao=?,previsao_entrega=?,condicao_pagamento=? WHERE id=? AND status='RASCUNHO'`, p.FornecedorID, p.FornecedorNome, p.Observacao, rfc3339(p.PrevisaoEntrega), p.CondicaoPagamento, p.ID)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return fmt.Errorf("somente rascunho pode ser editado")
	}
	return nil
}
func (r *ComprasProcessoRepositorio) RegistrarDocumento(ctx context.Context, d *dominio.Documento) error {
	d.ID = uuid.NewString()
	d.CriadoEm = time.Now().UTC()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO compras_documentos(id,pedido_id,cotacao_id,tipo,nome,conteudo,registrado_por,criado_em)VALUES(?,?,?,?,?,?,?,?)`, d.ID, d.PedidoID, d.CotacaoID, d.Tipo, d.Nome, d.Conteudo, d.RegistradoPor, d.CriadoEm.Format(time.RFC3339))
	return e
}
func (r *ComprasProcessoRepositorio) ListarDocumentos(ctx context.Context, pedidoID, cotacaoID string) ([]dominio.Documento, error) {
	q := `SELECT id,pedido_id,cotacao_id,tipo,nome,conteudo,registrado_por,criado_em FROM compras_documentos WHERE `
	arg := pedidoID
	if pedidoID != "" {
		q += `pedido_id=?`
	} else {
		q += `cotacao_id=?`
		arg = cotacaoID
	}
	rows, e := r.DB.QueryContext(ctx, q, arg)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Documento
	for rows.Next() {
		var d dominio.Documento
		var pi, ci sql.NullString
		var cr string
		if e = rows.Scan(&d.ID, &pi, &ci, &d.Tipo, &d.Nome, &d.Conteudo, &d.RegistradoPor, &cr); e != nil {
			return nil, e
		}
		d.PedidoID = txt(pi)
		d.CotacaoID = txt(ci)
		d.CriadoEm, _ = time.Parse(time.RFC3339, cr)
		out = append(out, d)
	}
	return out, rows.Err()
}
func (r *ComprasProcessoRepositorio) RegistrarDivergencias(ctx context.Context, ds []dominio.Divergencia) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	for i := range ds {
		ds[i].ID = uuid.NewString()
		ds[i].Status = "PENDENTE"
		ds[i].CriadoEm = time.Now().UTC()
		if _, e = tx.ExecContext(ctx, `INSERT INTO compras_divergencias(id,recebimento_id,pedido_item_id,tipo,esperado,encontrado,status,criado_em)VALUES(?,?,?,?,?,?,?,?)`, ds[i].ID, ds[i].RecebimentoID, ds[i].PedidoItemID, ds[i].Tipo, ds[i].Esperado, ds[i].Encontrado, ds[i].Status, ds[i].CriadoEm.Format(time.RFC3339)); e != nil {
			return e
		}
	}
	return tx.Commit()
}
func (r *ComprasProcessoRepositorio) ListarDivergencias(ctx context.Context, status string) ([]dominio.Divergencia, error) {
	q := `SELECT id,recebimento_id,pedido_item_id,tipo,esperado,encontrado,status,resolvido_por,resolvido_em,justificativa,criado_em FROM compras_divergencias`
	var rows *sql.Rows
	var e error
	if status != "" {
		rows, e = r.DB.QueryContext(ctx, q+` WHERE status=? ORDER BY criado_em DESC`, status)
	} else {
		rows, e = r.DB.QueryContext(ctx, q+` ORDER BY criado_em DESC`)
	}
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Divergencia
	for rows.Next() {
		var d dominio.Divergencia
		var pi, rp, re, ju sql.NullString
		var cr string
		if e = rows.Scan(&d.ID, &d.RecebimentoID, &pi, &d.Tipo, &d.Esperado, &d.Encontrado, &d.Status, &rp, &re, &ju, &cr); e != nil {
			return nil, e
		}
		d.PedidoItemID = txt(pi)
		d.ResolvidoPor = txt(rp)
		d.ResolvidoEm = dataNula(re)
		d.Justificativa = txt(ju)
		d.CriadoEm, _ = time.Parse(time.RFC3339, cr)
		out = append(out, d)
	}
	return out, rows.Err()
}
func (r *ComprasProcessoRepositorio) ResolverDivergencia(ctx context.Context, id, status, justificativa, ator string) error {
	if status != "ACEITA" && status != "RECUSADA" {
		return fmt.Errorf("decisão inválida")
	}
	res, e := r.DB.ExecContext(ctx, `UPDATE compras_divergencias SET status=?,resolvido_por=?,resolvido_em=?,justificativa=? WHERE id=? AND status='PENDENTE'`, status, ator, time.Now().UTC().Format(time.RFC3339), justificativa, id)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return fmt.Errorf("divergência já resolvida")
	}
	return nil
}
func (r *ComprasProcessoRepositorio) UltimoNumeroDevolucao(ctx context.Context, prefixo string) (string, error) {
	var n string
	e := r.DB.QueryRowContext(ctx, `SELECT numero FROM compras_devolucoes WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`, prefixo+"%").Scan(&n)
	if errors.Is(e, sql.ErrNoRows) {
		return "", nil
	}
	return n, e
}
func (r *ComprasProcessoRepositorio) CriarDevolucao(ctx context.Context, d *dominio.Devolucao) error {
	tx, e := r.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	d.ID = uuid.NewString()
	d.CriadoEm = time.Now().UTC()
	_, e = tx.ExecContext(ctx, `INSERT INTO compras_devolucoes(id,numero,recebimento_id,fornecedor_id,motivo,status,registrado_por,criado_em)VALUES(?,?,?,?,?,'REGISTRADA',?,?)`, d.ID, d.Numero, d.RecebimentoID, d.FornecedorID, d.Motivo, d.RegistradoPor, d.CriadoEm.Format(time.RFC3339))
	if e != nil {
		return e
	}
	for _, i := range d.Itens {
		if _, e = tx.ExecContext(ctx, `INSERT INTO compras_devolucao_itens(id,devolucao_id,material_id,quantidade,valor_unitario_centavos)VALUES(?,?,?,?,?)`, uuid.NewString(), d.ID, i.MaterialID, i.Quantidade, i.ValorUnitarioCentavos); e != nil {
			return e
		}
	}
	return tx.Commit()
}
func (r *ComprasProcessoRepositorio) ListarDevolucoes(ctx context.Context) ([]dominio.Devolucao, error) {
	rows, e := r.DB.QueryContext(ctx, `SELECT id,numero,recebimento_id,fornecedor_id,motivo,status,registrado_por,criado_em,concluido_em FROM compras_devolucoes ORDER BY criado_em DESC`)
	if e != nil {
		return nil, e
	}
	var out []dominio.Devolucao
	for rows.Next() {
		var d dominio.Devolucao
		var cr string
		var co sql.NullString
		if e = rows.Scan(&d.ID, &d.Numero, &d.RecebimentoID, &d.FornecedorID, &d.Motivo, &d.Status, &d.RegistradoPor, &cr, &co); e != nil {
			return nil, e
		}
		d.CriadoEm, _ = time.Parse(time.RFC3339, cr)
		d.ConcluidoEm = dataNula(co)
		out = append(out, d)
	}
	if e = rows.Err(); e != nil {
		rows.Close()
		return nil, e
	}
	if e = rows.Close(); e != nil {
		return nil, e
	}
	for i := range out {
		itens, err := r.DB.QueryContext(ctx, `SELECT material_id,quantidade,valor_unitario_centavos FROM compras_devolucao_itens WHERE devolucao_id=?`, out[i].ID)
		if err != nil {
			return nil, err
		}
		for itens.Next() {
			var item dominio.ItemDevolucao
			if err = itens.Scan(&item.MaterialID, &item.Quantidade, &item.ValorUnitarioCentavos); err != nil {
				itens.Close()
				return nil, err
			}
			out[i].Itens = append(out[i].Itens, item)
		}
		if err = itens.Err(); err != nil {
			itens.Close()
			return nil, err
		}
		itens.Close()
	}
	return out, nil
}
func (r *ComprasProcessoRepositorio) CriarContrato(ctx context.Context, c *dominio.Contrato) error {
	c.ID = uuid.NewString()
	c.CriadoEm = time.Now().UTC()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO compras_contratos(id,numero,fornecedor_id,fornecedor_nome,objeto,inicio,fim,valor_limite_centavos,periodicidade,proxima_geracao,condicao_pagamento,ativo,observacao,criado_por,criado_em)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, c.ID, c.Numero, c.FornecedorID, c.FornecedorNome, c.Objeto, c.Inicio.Format(time.DateOnly), rfc3339(c.Fim), c.ValorLimiteCentavos, c.Periodicidade, rfc3339(c.ProximaGeracao), c.CondicaoPagamento, 1, c.Observacao, c.CriadoPor, c.CriadoEm.Format(time.RFC3339))
	return e
}
func (r *ComprasProcessoRepositorio) ListarContratos(ctx context.Context) ([]dominio.Contrato, error) {
	rows, e := r.DB.QueryContext(ctx, `SELECT id,numero,fornecedor_id,fornecedor_nome,objeto,inicio,fim,valor_limite_centavos,valor_consumido_centavos,periodicidade,proxima_geracao,condicao_pagamento,ativo,observacao,criado_por,criado_em FROM compras_contratos ORDER BY criado_em DESC`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Contrato
	for rows.Next() {
		var c dominio.Contrato
		var ini, cr string
		var fim, prox, cond, obs sql.NullString
		var lim sql.NullInt64
		var ativo int
		if e = rows.Scan(&c.ID, &c.Numero, &c.FornecedorID, &c.FornecedorNome, &c.Objeto, &ini, &fim, &lim, &c.ValorConsumidoCentavos, &c.Periodicidade, &prox, &cond, &ativo, &obs, &c.CriadoPor, &cr); e != nil {
			return nil, e
		}
		c.Inicio, _ = time.Parse(time.DateOnly, ini)
		c.Fim = dataNula(fim)
		if lim.Valid {
			c.ValorLimiteCentavos = &lim.Int64
		}
		c.ProximaGeracao = dataNula(prox)
		c.CondicaoPagamento = txt(cond)
		c.Ativo = ativo != 0
		c.Observacao = txt(obs)
		c.CriadoEm, _ = time.Parse(time.RFC3339, cr)
		out = append(out, c)
	}
	return out, rows.Err()
}
func (r *ComprasProcessoRepositorio) AvaliarFornecedor(ctx context.Context, a *dominio.AvaliacaoFornecedor) error {
	a.ID = uuid.NewString()
	a.CriadoEm = time.Now().UTC()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO compras_avaliacoes_fornecedor(id,fornecedor_id,pedido_id,prazo,qualidade,atendimento,observacao,avaliado_por,criado_em)VALUES(?,?,?,?,?,?,?,?,?)`, a.ID, a.FornecedorID, a.PedidoID, a.Prazo, a.Qualidade, a.Atendimento, a.Observacao, a.AvaliadoPor, a.CriadoEm.Format(time.RFC3339))
	return e
}
func (r *ComprasProcessoRepositorio) Indicadores(ctx context.Context) (i dominio.IndicadoresCompras, e error) {
	e = r.DB.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM compras_pedidos WHERE status='PENDENTE_APROVACAO'),(SELECT count(*) FROM compras_pedidos WHERE status IN('ENVIADO','PARCIAL') AND previsao_entrega<date('now')),(SELECT count(*) FROM compras_cotacoes WHERE status IN('ABERTA','EM_ANALISE')),(SELECT count(*) FROM compras_divergencias WHERE status='PENDENTE'),coalesce((SELECT round(sum(total_recebido)*100) FROM compras_pedidos),0),coalesce((SELECT sum(maior_total-p.total_centavos) FROM compras_propostas p JOIN (SELECT cotacao_id,max(total_centavos) maior_total FROM compras_propostas GROUP BY cotacao_id) m ON m.cotacao_id=p.cotacao_id WHERE p.selecionada=1),0),coalesce((SELECT avg(julianday(coalesce(recebido_em,date('now')))-julianday(criado_em)) FROM compras_pedidos WHERE status='RECEBIDO'),0)`).Scan(&i.PedidosPendentes, &i.PedidosAtrasados, &i.CotacoesAbertas, &i.DivergenciasPendentes, &i.TotalCompradoCentavos, &i.EconomiaCotacoesCentavos, &i.LeadTimeMedioDias)
	return
}

func (r *ComprasProcessoRepositorio) ListarDesempenhoFornecedores(ctx context.Context) ([]dominio.DesempenhoFornecedor, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT f.id,f.nome,count(DISTINCT a.id),coalesce(avg(a.prazo),0),coalesce(avg(a.qualidade),0),coalesce(avg(a.atendimento),0),(SELECT count(*) FROM compras_pedidos p WHERE p.fornecedor_id=f.id),coalesce((SELECT round(sum(p.total_recebido)*100) FROM compras_pedidos p WHERE p.fornecedor_id=f.id),0) FROM fornecedores f LEFT JOIN compras_avaliacoes_fornecedor a ON a.fornecedor_id=f.id GROUP BY f.id,f.nome HAVING count(a.id)>0 OR (SELECT count(*) FROM compras_pedidos p WHERE p.fornecedor_id=f.id)>0 ORDER BY avg(a.qualidade) DESC,f.nome`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resultado []dominio.DesempenhoFornecedor
	for rows.Next() {
		var d dominio.DesempenhoFornecedor
		if err = rows.Scan(&d.FornecedorID, &d.FornecedorNome, &d.QuantidadeAvaliacoes, &d.MediaPrazo, &d.MediaQualidade, &d.MediaAtendimento, &d.QuantidadePedidos, &d.TotalCompradoCentavos); err != nil {
			return nil, err
		}
		resultado = append(resultado, d)
	}
	return resultado, rows.Err()
}
