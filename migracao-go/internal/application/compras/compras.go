package compras

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/comum"
	cadastro "siqueiracampos/servidor/internal/domain/cadastro"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

type Gerenciador struct {
	Pedidos       compras.PedidoRepositorio
	Recebimentos  compras.RecebimentoRepositorio
	Contas        compras.ContaPagarRepositorio
	Fornecedores  compras.FornecedorRepositorio
	Solicitacoes  compras.SolicitacaoRepositorio
	Materiais     compras.MaterialRepositorio
	Movimentacoes compras.MovimentacaoRepositorio
}

type EntradaPedido struct {
	SolicitacaoID string
	FornecedorID  string
	Observacao    string
}

type ItemRecebimentoEntrada struct {
	PedidoItemID  string
	Quantidade    string
	ValorUnitario string
}

type EntradaRecebimento struct {
	PedidoID   string
	NotaFiscal string
	Vencimento string
	Observacao string
	Itens      []ItemRecebimentoEntrada
}

type Resumo struct {
	PedidosPendentes []compras.PedidoCompra
	PedidosRecentes  []compras.PedidoCompra
	ContasAbertas    []compras.ContaPagar
	Solicitacoes     []estoque.SolicitacaoCompra
	Fornecedores     []cadastro.Fornecedor
	TotalAberto      float64
}

func (g *Gerenciador) Resumo(ctx context.Context) (*Resumo, error) {
	pedidos, err := g.Pedidos.Listar(ctx)
	if err != nil {
		return nil, err
	}
	contas, err := g.Contas.ListarAbertas(ctx)
	if err != nil {
		return nil, err
	}
	solicitacoes, err := g.Solicitacoes.Listar(ctx)
	if err != nil {
		return nil, err
	}
	fornecedores, err := g.Fornecedores.ListarAtivos(ctx)
	if err != nil {
		return nil, err
	}

	pendentes := make([]estoque.SolicitacaoCompra, 0, len(solicitacoes))
	for _, s := range solicitacoes {
		if s.Status == estoque.StatusEnviada || s.Status == estoque.StatusAtendida {
			pendentes = append(pendentes, s)
		}
	}

	total := 0.0
	for _, c := range contas {
		total += c.ValorAberto
	}

	pedidosPendentes := make([]compras.PedidoCompra, 0, len(pedidos))
	pedidosRecentes := make([]compras.PedidoCompra, 0, len(pedidos))
	for _, p := range pedidos {
		if p.Status != compras.StatusPedidoRecebido && p.Status != compras.StatusPedidoCancelado {
			pedidosPendentes = append(pedidosPendentes, p)
		}
		pedidosRecentes = append(pedidosRecentes, p)
		if len(pedidosRecentes) == 10 {
			break
		}
	}

	return &Resumo{
		PedidosPendentes: pedidosPendentes,
		PedidosRecentes: pedidosRecentes,
		ContasAbertas: contas,
		Solicitacoes: pendentes,
		Fornecedores: fornecedores,
		TotalAberto: total,
	}, nil
}

func (g *Gerenciador) CriarPedido(ctx context.Context, _ identidade.Sessao, e EntradaPedido) (*compras.PedidoCompra, error) {
	solicitacaoID := strings.TrimSpace(e.SolicitacaoID)
	fornecedorID := strings.TrimSpace(e.FornecedorID)
	if solicitacaoID == "" {
		return nil, erroValidacao("Informe a solicitação de origem.")
	}
	if fornecedorID == "" {
		return nil, erroValidacao("Informe o fornecedor.")
	}

	solicitacao, err := g.Solicitacoes.BuscarPorID(ctx, solicitacaoID)
	if err != nil {
		return nil, err
	}
	if solicitacao == nil {
		return nil, erroValidacao("Solicitação não encontrada.")
	}
	if solicitacao.Status != estoque.StatusEnviada && solicitacao.Status != estoque.StatusAtendida {
		return nil, erroValidacao("Use uma solicitação já enviada ou aprovada.")
	}
	if len(solicitacao.Itens) == 0 {
		return nil, erroValidacao("A solicitação não tem itens.")
	}

	fornecedor, err := g.Fornecedores.BuscarPorID(ctx, fornecedorID)
	if err != nil {
		return nil, err
	}
	if fornecedor == nil || !fornecedor.Ativo {
		return nil, erroValidacao("Fornecedor inválido ou inativo.")
	}

	numero, err := g.proximoNumeroPedido(ctx)
	if err != nil {
		return nil, err
	}

	itens := make([]compras.ItemPedidoCompra, 0, len(solicitacao.Itens))
	totalEstimado := 0.0
	for _, item := range solicitacao.Itens {
		pedidoItem := compras.ItemPedidoCompra{
			MaterialID: item.MaterialID,
			MaterialCodigo: item.MaterialCodigo,
			MaterialNome: item.MaterialNome,
			MaterialUnidade: item.MaterialUnidade,
			QuantidadeSolicitada: item.Quantidade,
			Observacao: item.Observacao,
		}
		if item.PrecoEstimado != nil {
			pedidoItem.PrecoUnitario = item.PrecoEstimado
			totalEstimado += *item.PrecoEstimado * item.Quantidade
		}
		itens = append(itens, pedidoItem)
	}

	pedido := &compras.PedidoCompra{
		Numero: numero,
		SolicitacaoID: &solicitacao.ID,
		FornecedorID: fornecedor.ID,
		FornecedorNome: fornecedor.Nome,
		Observacao: strPtr(strings.TrimSpace(e.Observacao)),
		Status: compras.StatusPedidoAberto,
		CriadoEm: agora(),
		TotalEstimado: totalEstimado,
		Itens: itens,
	}
	if err := g.Pedidos.Criar(ctx, pedido); err != nil {
		return nil, err
	}
	return pedido, nil
}

func (g *Gerenciador) RegistrarRecebimento(ctx context.Context, sess identidade.Sessao, e EntradaRecebimento) (*compras.RecebimentoCompra, error) {
	pedidoID := strings.TrimSpace(e.PedidoID)
	if pedidoID == "" {
		return nil, erroValidacao("Pedido inválido.")
	}
	pedido, err := g.Pedidos.BuscarPorID(ctx, pedidoID)
	if err != nil {
		return nil, err
	}
	if pedido == nil {
		return nil, erroValidacao("Pedido não encontrado.")
	}
	if pedido.Status == compras.StatusPedidoCancelado {
		return nil, erroValidacao("Pedido cancelado não pode receber mercadoria.")
	}

	numero, err := g.proximoNumeroRecebimento(ctx)
	if err != nil {
		return nil, err
	}

	recebimento := &compras.RecebimentoCompra{
		PedidoID: pedido.ID,
		Numero: numero,
		RecebidoEm: agora(),
		RecebidoPor: sess.Nome,
		NotaFiscal: strPtr(strings.TrimSpace(e.NotaFiscal)),
		Observacao: strPtr(strings.TrimSpace(e.Observacao)),
	}

	itensRecebimento := make([]compras.ItemRecebimentoCompra, 0, len(e.Itens))
	totalRecebido := 0.0

	for _, entrada := range e.Itens {
		itemID := strings.TrimSpace(entrada.PedidoItemID)
		if itemID == "" {
			continue
		}
		quantidade := parseFloat(entrada.Quantidade)
		if quantidade <= 0 {
			continue
		}
		valorUnitario := parseFloat(entrada.ValorUnitario)
		if valorUnitario < 0 {
			return nil, erroValidacao("Valor unitário inválido.")
		}

		itemPedido := localizarPedidoItem(pedido.Itens, itemID)
		if itemPedido == nil {
			return nil, erroValidacao("Item informado não pertence ao pedido.")
		}
		restante := itemPedido.QuantidadeSolicitada - itemPedido.QuantidadeRecebida
		if quantidade > restante {
			return nil, erroValidacao(fmt.Sprintf("O item %s só tem %s restante.", itemPedido.MaterialNome, formatarNumero(restante)))
		}

		itensRecebimento = append(itensRecebimento, compras.ItemRecebimentoCompra{
			PedidoItemID: itemID,
			MaterialID: itemPedido.MaterialID,
			Quantidade: quantidade,
			ValorUnitario: valorUnitario,
		})
		totalRecebido += quantidade * valorUnitario
	}
	if len(itensRecebimento) == 0 {
		return nil, erroValidacao("Informe ao menos um item para o recebimento.")
	}
	recebimento.Itens = itensRecebimento

	if err := g.Recebimentos.Criar(ctx, recebimento); err != nil {
		return nil, err
	}

	for _, item := range itensRecebimento {
		if err := g.Pedidos.AtualizarItemRecebido(ctx, item.PedidoItemID, item.Quantidade); err != nil {
			return nil, err
		}
		for i := range pedido.Itens {
			if pedido.Itens[i].ID == item.PedidoItemID {
				pedido.Itens[i].QuantidadeRecebida += item.Quantidade
				break
			}
		}
		descricao := fmt.Sprintf("Recebimento %s / pedido %s", recebimento.Numero, pedido.Numero)
		mov := &estoque.Movimentacao{
			Tipo: estoque.MovEntrada,
			Quantidade: item.Quantidade,
			ValorUnitario: &item.ValorUnitario,
			Documento: recebimento.NotaFiscal,
			Observacao: &descricao,
			OcorridoEm: recebimento.RecebidoEm,
			RegistradoPor: &sess.Nome,
			MaterialID: item.MaterialID,
			FornecedorID: &pedido.FornecedorID,
		}
		if err := g.Movimentacoes.Criar(ctx, mov); err != nil {
			return nil, err
		}
	}

	status := compras.StatusPedidoParcial
	if pedidoItensRecebidosCompletos(pedido) {
		status = compras.StatusPedidoRecebido
	}
	recebidoEm := recebimento.RecebidoEm.Format(time.RFC3339)
	if err := g.Pedidos.AtualizarStatus(ctx, pedido.ID, status, &recebidoEm, totalRecebido); err != nil {
		return nil, err
	}

	vencimento := comum.ParseDataBR(strings.TrimSpace(e.Vencimento))
	if vencimento == nil {
		t := recebimento.RecebidoEm.AddDate(0, 0, 30)
		vencimento = &t
	}
	numConta, err := g.proximoNumeroConta(ctx)
	if err != nil {
		return nil, err
	}
	conta := &compras.ContaPagar{
		Numero: numConta,
		PedidoID: &pedido.ID,
		FornecedorID: pedido.FornecedorID,
		FornecedorNome: pedido.FornecedorNome,
		ValorTotal: totalRecebido,
		ValorAberto: totalRecebido,
		Vencimento: *vencimento,
		Status: "ABERTA",
		CriadoEm: recebimento.RecebidoEm,
		Observacao: recebimento.Observacao,
	}
	if err := g.Contas.Criar(ctx, conta); err != nil {
		return nil, err
	}
	if err := g.Recebimentos.AtualizarContaPagar(ctx, recebimento.ID, conta.ID); err != nil {
		return nil, err
	}
	recebimento.ContaPagarID = &conta.ID
	return recebimento, nil
}

func (g *Gerenciador) proximoNumeroPedido(ctx context.Context) (string, error) {
	ano := agora().Year()
	prefixo := fmt.Sprintf("CP-%d-", ano)
	ultimo, err := g.Pedidos.UltimoNumero(ctx, prefixo)
	if err != nil {
		return "", err
	}
	return proximoNumero(prefixo, ultimo), nil
}

func (g *Gerenciador) proximoNumeroRecebimento(ctx context.Context) (string, error) {
	ano := agora().Year()
	prefixo := fmt.Sprintf("REC-%d-", ano)
	ultimo, err := g.Recebimentos.UltimoNumero(ctx, prefixo)
	if err != nil {
		return "", err
	}
	return proximoNumero(prefixo, ultimo), nil
}

func (g *Gerenciador) proximoNumeroConta(ctx context.Context) (string, error) {
	ano := agora().Year()
	prefixo := fmt.Sprintf("CPA-%d-", ano)
	ultimo, err := g.Contas.UltimoNumero(ctx, prefixo)
	if err != nil {
		return "", err
	}
	return proximoNumero(prefixo, ultimo), nil
}

func proximoNumero(prefixo, ultimo string) string {
	sequencia := 1
	if strings.HasPrefix(ultimo, prefixo) {
		partes := strings.Split(ultimo, "-")
		if len(partes) == 3 {
			if n, err := strconv.Atoi(partes[2]); err == nil {
				sequencia = n + 1
			}
		}
	}
	return fmt.Sprintf("%s%04d", prefixo, sequencia)
}

func pedidoItensRecebidosCompletos(p *compras.PedidoCompra) bool {
	if p == nil {
		return false
	}
	for _, item := range p.Itens {
		if item.QuantidadeRecebida < item.QuantidadeSolicitada {
			return false
		}
	}
	return true
}

func localizarPedidoItem(itens []compras.ItemPedidoCompra, id string) *compras.ItemPedidoCompra {
	for i := range itens {
		if itens[i].ID == id {
			return &itens[i]
		}
	}
	return nil
}

func parseFloat(texto string) float64 {
	texto = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(texto, ".", ""), ",", "."))
	if texto == "" {
		return 0
	}
	v, _ := strconv.ParseFloat(texto, 64)
	return v
}

func strPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}
