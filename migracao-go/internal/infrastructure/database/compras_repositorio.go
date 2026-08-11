package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/compras"
)

type ComprasPedidoRepositorio struct{ DB *sql.DB }

func NovoComprasPedidoRepositorio(db *sql.DB) *ComprasPedidoRepositorio {
	return &ComprasPedidoRepositorio{DB: db}
}

type ComprasRecebimentoRepositorio struct{ DB *sql.DB }

func NovoComprasRecebimentoRepositorio(db *sql.DB) *ComprasRecebimentoRepositorio {
	return &ComprasRecebimentoRepositorio{DB: db}
}

type ContasPagarRepositorio struct{ DB *sql.DB }

func NovoContasPagarRepositorio(db *sql.DB) *ContasPagarRepositorio {
	return &ContasPagarRepositorio{DB: db}
}

const colunasPedidoCompra = `id, numero, status, solicitacao_id, fornecedor_id, fornecedor_nome, observacao, criado_em, recebido_em, total_estimado, total_recebido`
const colunasItemPedidoCompra = `id, pedido_id, material_id, material_codigo, material_nome, material_unidade, quantidade_solicitada, quantidade_recebida, preco_unitario, observacao`
const colunasRecebimentoCompra = `id, pedido_id, numero, recebido_em, recebido_por, nota_fiscal, observacao, conta_pagar_id`
const colunasItemRecebimentoCompra = `id, recebimento_id, pedido_item_id, material_id, quantidade, valor_unitario`
const colunasContaPagar = `id, numero, pedido_id, recebimento_id, fornecedor_id, fornecedor_nome, valor_total, valor_aberto, vencimento, status, criado_em, pago_em, observacao`

func lerPedidoCompra(linha linhaEscaneavel) (*compras.PedidoCompra, error) {
	var p compras.PedidoCompra
	var status string
	var solicitacaoID sql.NullString
	var recebidoEm sql.NullString
	var observacao sql.NullString
	var criadoEm string
	if err := linha.Scan(
		&p.ID, &p.Numero, &status, &solicitacaoID, &p.FornecedorID, &p.FornecedorNome,
		&observacao, &criadoEm, &recebidoEm, &p.TotalEstimado, &p.TotalRecebido,
	); err != nil {
		return nil, err
	}
	p.Status = compras.StatusPedidoCompra(status)
	if solicitacaoID.Valid {
		p.SolicitacaoID = &solicitacaoID.String
	}
	if observacao.Valid {
		p.Observacao = &observacao.String
	}
	p.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	if recebidoEm.Valid {
		t, _ := time.Parse(time.RFC3339, recebidoEm.String)
		p.RecebidoEm = &t
	}
	return &p, nil
}

func lerItemPedidoCompra(linha linhaEscaneavel) (*compras.ItemPedidoCompra, error) {
	var item compras.ItemPedidoCompra
	var preco sql.NullFloat64
	var observacao sql.NullString
	if err := linha.Scan(
		&item.ID, &item.PedidoID, &item.MaterialID, &item.MaterialCodigo, &item.MaterialNome, &item.MaterialUnidade,
		&item.QuantidadeSolicitada, &item.QuantidadeRecebida, &preco, &observacao,
	); err != nil {
		return nil, err
	}
	if preco.Valid {
		v := preco.Float64
		item.PrecoUnitario = &v
	}
	if observacao.Valid {
		item.Observacao = &observacao.String
	}
	return &item, nil
}

func lerRecebimentoCompra(linha linhaEscaneavel) (*compras.RecebimentoCompra, error) {
	var r compras.RecebimentoCompra
	var notaFiscal sql.NullString
	var observacao sql.NullString
	var contaPagarID sql.NullString
	var recebidoEm string
	if err := linha.Scan(
		&r.ID, &r.PedidoID, &r.Numero, &recebidoEm, &r.RecebidoPor, &notaFiscal, &observacao, &contaPagarID,
	); err != nil {
		return nil, err
	}
	r.RecebidoEm, _ = time.Parse(time.RFC3339, recebidoEm)
	if notaFiscal.Valid {
		r.NotaFiscal = &notaFiscal.String
	}
	if observacao.Valid {
		r.Observacao = &observacao.String
	}
	if contaPagarID.Valid {
		r.ContaPagarID = &contaPagarID.String
	}
	return &r, nil
}

func lerItemRecebimentoCompra(linha linhaEscaneavel) (*compras.ItemRecebimentoCompra, error) {
	var item compras.ItemRecebimentoCompra
	if err := linha.Scan(&item.ID, &item.RecebimentoID, &item.PedidoItemID, &item.MaterialID, &item.Quantidade, &item.ValorUnitario); err != nil {
		return nil, err
	}
	return &item, nil
}

func lerContaPagar(linha linhaEscaneavel) (*compras.ContaPagar, error) {
	var c compras.ContaPagar
	var pedidoID sql.NullString
	var recebimentoID sql.NullString
	var pagoEm sql.NullString
	var observacao sql.NullString
	var vencimento, criadoEm string
	if err := linha.Scan(
		&c.ID, &c.Numero, &pedidoID, &recebimentoID, &c.FornecedorID, &c.FornecedorNome,
		&c.ValorTotal, &c.ValorAberto, &vencimento, &c.Status, &criadoEm, &pagoEm, &observacao,
	); err != nil {
		return nil, err
	}
	if pedidoID.Valid {
		c.PedidoID = &pedidoID.String
	}
	if recebimentoID.Valid {
		c.RecebimentoID = &recebimentoID.String
	}
	c.Vencimento, _ = time.Parse(time.RFC3339, vencimento)
	c.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	if pagoEm.Valid {
		t, _ := time.Parse(time.RFC3339, pagoEm.String)
		c.PagoEm = &t
	}
	if observacao.Valid {
		c.Observacao = &observacao.String
	}
	return &c, nil
}

func (r *ComprasPedidoRepositorio) buscarItens(ctx context.Context, pedidoID string) ([]compras.ItemPedidoCompra, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasItemPedidoCompra+` FROM compras_pedido_itens WHERE pedido_id = ? ORDER BY material_nome ASC`, pedidoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var itens []compras.ItemPedidoCompra
	for linhas.Next() {
		item, err := lerItemPedidoCompra(linhas)
		if err != nil {
			return nil, err
		}
		itens = append(itens, *item)
	}
	return itens, linhas.Err()
}

func (r *ComprasRecebimentoRepositorio) buscarItens(ctx context.Context, recebimentoID string) ([]compras.ItemRecebimentoCompra, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasItemRecebimentoCompra+` FROM compras_recebimento_itens WHERE recebimento_id = ? ORDER BY id ASC`, recebimentoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var itens []compras.ItemRecebimentoCompra
	for linhas.Next() {
		item, err := lerItemRecebimentoCompra(linhas)
		if err != nil {
			return nil, err
		}
		itens = append(itens, *item)
	}
	return itens, linhas.Err()
}

func (r *ComprasPedidoRepositorio) BuscarPorID(ctx context.Context, id string) (*compras.PedidoCompra, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasPedidoCompra+` FROM compras_pedidos WHERE id = ?`, id)
	p, err := lerPedidoCompra(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	itens, err := r.buscarItens(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Itens = itens
	return p, nil
}

func (r *ComprasPedidoRepositorio) Listar(ctx context.Context) ([]compras.PedidoCompra, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasPedidoCompra+` FROM compras_pedidos ORDER BY criado_em DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var pedidos []compras.PedidoCompra
	for linhas.Next() {
		p, err := lerPedidoCompra(linhas)
		if err != nil {
			return nil, err
		}
		pedidos = append(pedidos, *p)
	}
	if err := linhas.Err(); err != nil {
		return nil, err
	}

	for i := range pedidos {
		itens, err := r.buscarItens(ctx, pedidos[i].ID)
		if err != nil {
			return nil, err
		}
		pedidos[i].Itens = itens
	}
	return pedidos, nil
}

func (r *ComprasPedidoRepositorio) UltimoNumero(ctx context.Context, prefixo string) (string, error) {
	var numero string
	err := r.DB.QueryRowContext(ctx,
		`SELECT numero FROM compras_pedidos WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`,
		prefixo+"%",
	).Scan(&numero)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return numero, err
}

func (r *ComprasPedidoRepositorio) Criar(ctx context.Context, p *compras.PedidoCompra) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO compras_pedidos
			(id, numero, status, solicitacao_id, fornecedor_id, fornecedor_nome, observacao, criado_em, total_estimado, total_recebido)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.Numero, string(p.Status), p.SolicitacaoID, p.FornecedorID, p.FornecedorNome, p.Observacao, agora, p.TotalEstimado, p.TotalRecebido,
	); err != nil {
		return err
	}

	for _, item := range p.Itens {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO compras_pedido_itens
				(id, pedido_id, material_id, material_codigo, material_nome, material_unidade, quantidade_solicitada, quantidade_recebida, preco_unitario, observacao)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), id, item.MaterialID, item.MaterialCodigo, item.MaterialNome, item.MaterialUnidade,
			item.QuantidadeSolicitada, item.QuantidadeRecebida, item.PrecoUnitario, item.Observacao,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	p.ID = id
	p.CriadoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}

func (r *ComprasPedidoRepositorio) AtualizarStatus(ctx context.Context, id string, status compras.StatusPedidoCompra, recebidoEm *string, totalRecebido float64) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE compras_pedidos
		SET status = ?, recebido_em = COALESCE(?, recebido_em), total_recebido = ?
		WHERE id = ?`,
		string(status), recebidoEm, totalRecebido, id,
	)
	return err
}

func (r *ComprasPedidoRepositorio) AtualizarItemRecebido(ctx context.Context, itemID string, quantidadeRecebida float64) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE compras_pedido_itens
		SET quantidade_recebida = quantidade_recebida + ?
		WHERE id = ?`,
		quantidadeRecebida, itemID,
	)
	return err
}

func (r *ComprasRecebimentoRepositorio) BuscarPorID(ctx context.Context, id string) (*compras.RecebimentoCompra, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasRecebimentoCompra+` FROM compras_recebimentos WHERE id = ?`, id)
	rq, err := lerRecebimentoCompra(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	itens, err := r.buscarItens(ctx, rq.ID)
	if err != nil {
		return nil, err
	}
	rq.Itens = itens
	return rq, nil
}

func (r *ComprasRecebimentoRepositorio) Listar(ctx context.Context) ([]compras.RecebimentoCompra, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT `+colunasRecebimentoCompra+` FROM compras_recebimentos ORDER BY recebido_em DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var recebimentos []compras.RecebimentoCompra
	for linhas.Next() {
		rq, err := lerRecebimentoCompra(linhas)
		if err != nil {
			return nil, err
		}
		recebimentos = append(recebimentos, *rq)
	}
	if err := linhas.Err(); err != nil {
		return nil, err
	}

	for i := range recebimentos {
		itens, err := r.buscarItens(ctx, recebimentos[i].ID)
		if err != nil {
			return nil, err
		}
		recebimentos[i].Itens = itens
	}
	return recebimentos, nil
}

func (r *ComprasRecebimentoRepositorio) UltimoNumero(ctx context.Context, prefixo string) (string, error) {
	var numero string
	err := r.DB.QueryRowContext(ctx,
		`SELECT numero FROM compras_recebimentos WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`,
		prefixo+"%",
	).Scan(&numero)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return numero, err
}

func (r *ComprasRecebimentoRepositorio) Criar(ctx context.Context, rq *compras.RecebimentoCompra) error {
	id := uuid.NewString()
	agora := rq.RecebidoEm.UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO compras_recebimentos (id, pedido_id, numero, recebido_em, recebido_por, nota_fiscal, observacao)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, rq.PedidoID, rq.Numero, agora, rq.RecebidoPor, rq.NotaFiscal, rq.Observacao,
	); err != nil {
		return err
	}

	for _, item := range rq.Itens {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO compras_recebimento_itens (id, recebimento_id, pedido_item_id, material_id, quantidade, valor_unitario)
			VALUES (?, ?, ?, ?, ?, ?)`,
			uuid.NewString(), id, item.PedidoItemID, item.MaterialID, item.Quantidade, item.ValorUnitario,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	rq.ID = id
	rq.RecebidoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}

func (r *ComprasRecebimentoRepositorio) AtualizarContaPagar(ctx context.Context, recebimentoID, contaPagarID string) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE compras_recebimentos
		SET conta_pagar_id = ?
		WHERE id = ?`,
		contaPagarID, recebimentoID,
	)
	return err
}

func (r *ContasPagarRepositorio) BuscarPorID(ctx context.Context, id string) (*compras.ContaPagar, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasContaPagar+` FROM contas_pagar WHERE id = ?`, id)
	c, err := lerContaPagar(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *ContasPagarRepositorio) ListarAbertas(ctx context.Context) ([]compras.ContaPagar, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT `+colunasContaPagar+`
		FROM contas_pagar
		WHERE status IN ('ABERTA', 'PARCIAL') AND valor_aberto > 0
		ORDER BY vencimento ASC, criado_em DESC
		LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var contas []compras.ContaPagar
	for linhas.Next() {
		c, err := lerContaPagar(linhas)
		if err != nil {
			return nil, err
		}
		contas = append(contas, *c)
	}
	return contas, linhas.Err()
}

func (r *ContasPagarRepositorio) UltimoNumero(ctx context.Context, prefixo string) (string, error) {
	var numero string
	err := r.DB.QueryRowContext(ctx,
		`SELECT numero FROM contas_pagar WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`,
		prefixo+"%",
	).Scan(&numero)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return numero, err
}

func (r *ContasPagarRepositorio) Criar(ctx context.Context, c *compras.ContaPagar) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO contas_pagar
			(id, numero, pedido_id, recebimento_id, fornecedor_id, fornecedor_nome, valor_total, valor_aberto, vencimento, status, criado_em, pago_em, observacao)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, c.Numero, c.PedidoID, c.RecebimentoID, c.FornecedorID, c.FornecedorNome, c.ValorTotal, c.ValorAberto,
		c.Vencimento.UTC().Format(time.RFC3339), c.Status, agora, c.PagoEm, c.Observacao,
	)
	if err != nil {
		return err
	}
	c.ID = id
	c.CriadoEm, _ = time.Parse(time.RFC3339, agora)
	return nil
}
