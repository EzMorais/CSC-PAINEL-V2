package compras

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	cadastro "siqueiracampos/servidor/internal/domain/cadastro"
	"siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/comum"
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
	Processos     compras.ProcessoRepositorio
	Financeiro    compras.ClienteFinanceiro
}

type EntradaPedido struct {
	SolicitacaoID string
	FornecedorID  string
	Observacao    string
	CotacaoID     string
	MotivoEscolha string
}

type ItemRecebimentoEntrada struct {
	PedidoItemID            string
	Quantidade              string
	ValorUnitario           string
	QuantidadeNF            string
	ValorNFUnitarioCentavos string
}

type EntradaRecebimento struct {
	PedidoID          string
	NotaFiscal        string
	Vencimento        string
	Observacao        string
	ChaveIdempotencia string
	DataEmissaoNF     string
	ChaveNF           string
	ValorNFCentavos   string
	Itens             []ItemRecebimentoEntrada
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
		PedidosRecentes:  pedidosRecentes,
		ContasAbertas:    contas,
		Solicitacoes:     pendentes,
		Fornecedores:     fornecedores,
		TotalAberto:      total,
	}, nil
}

func (g *Gerenciador) CriarPedido(ctx context.Context, sess identidade.Sessao, e EntradaPedido) (*compras.PedidoCompra, error) {
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
			MaterialID:           item.MaterialID,
			MaterialCodigo:       item.MaterialCodigo,
			MaterialNome:         item.MaterialNome,
			MaterialUnidade:      item.MaterialUnidade,
			QuantidadeSolicitada: item.Quantidade,
			Observacao:           item.Observacao,
		}
		if item.PrecoEstimado != nil {
			pedidoItem.PrecoUnitario = item.PrecoEstimado
			totalEstimado += *item.PrecoEstimado * item.Quantidade
		}
		itens = append(itens, pedidoItem)
	}

	pedido := &compras.PedidoCompra{
		Numero:         numero,
		SolicitacaoID:  &solicitacao.ID,
		FornecedorID:   fornecedor.ID,
		FornecedorNome: fornecedor.Nome,
		Observacao:     strPtr(strings.TrimSpace(e.Observacao)),
		Status:         compras.StatusPedidoRascunho,
		SolicitanteID:  sess.ID, SolicitanteNome: sess.Nome,
		CotacaoID: strPtr(strings.TrimSpace(e.CotacaoID)), MotivoEscolha: strPtr(strings.TrimSpace(e.MotivoEscolha)),
		CriadoEm:      agora(),
		TotalEstimado: totalEstimado,
		Itens:         itens,
	}
	if err := g.Pedidos.Criar(ctx, pedido); err != nil {
		return nil, err
	}
	return pedido, nil
}

func (g *Gerenciador) RegistrarRecebimento(ctx context.Context, sess identidade.Sessao, e EntradaRecebimento) (*compras.RecebimentoCompra, error) {
	chaveIdempotencia := strings.TrimSpace(e.ChaveIdempotencia)
	if chaveIdempotencia == "" {
		return nil, erroValidacao("Chave de idempotência do recebimento é obrigatória.")
	}
	jaRegistrado, err := g.Recebimentos.BuscarPorChave(ctx, chaveIdempotencia)
	if err != nil {
		return nil, err
	}
	if jaRegistrado != nil {
		return jaRegistrado, nil
	}
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
	if pedido.Status == compras.StatusPedidoCancelado || pedido.Status == compras.StatusPedidoRejeitado {
		return nil, erroValidacao("Pedido cancelado não pode receber mercadoria.")
	}
	if pedido.Status != compras.StatusPedidoEnviado && pedido.Status != compras.StatusPedidoParcial && pedido.Status != compras.StatusPedidoAprovado && pedido.Status != compras.StatusPedidoAberto {
		return nil, erroValidacao("Aprove e envie o pedido antes de receber mercadoria.")
	}

	numero, err := g.proximoNumeroRecebimento(ctx)
	if err != nil {
		return nil, err
	}

	recebimento := &compras.RecebimentoCompra{
		PedidoID:          pedido.ID,
		Numero:            numero,
		RecebidoEm:        agora(),
		RecebidoPor:       sess.Nome,
		NotaFiscal:        strPtr(strings.TrimSpace(e.NotaFiscal)),
		Observacao:        strPtr(strings.TrimSpace(e.Observacao)),
		ChaveIdempotencia: &chaveIdempotencia,
		DataEmissaoNF:     strPtr(strings.TrimSpace(e.DataEmissaoNF)),
		ChaveNF:           strPtr(strings.TrimSpace(e.ChaveNF)),
	}
	if texto := strings.TrimSpace(e.ValorNFCentavos); texto != "" {
		valor, parseErr := strconv.ParseInt(texto, 10, 64)
		if parseErr != nil || valor < 0 {
			return nil, erroValidacao("Valor total da nota fiscal inválido.")
		}
		recebimento.ValorNFCentavos = &valor
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

		itemRecebimento := compras.ItemRecebimentoCompra{
			PedidoItemID:  itemID,
			MaterialID:    itemPedido.MaterialID,
			Quantidade:    quantidade,
			ValorUnitario: valorUnitario,
		}
		if texto := strings.TrimSpace(entrada.QuantidadeNF); texto != "" {
			quantidadeNF := parseFloat(texto)
			if quantidadeNF < 0 {
				return nil, erroValidacao("Quantidade da nota fiscal inválida.")
			}
			itemRecebimento.QuantidadeNF = &quantidadeNF
		}
		if texto := strings.TrimSpace(entrada.ValorNFUnitarioCentavos); texto != "" {
			valorNF, parseErr := strconv.ParseInt(texto, 10, 64)
			if parseErr != nil || valorNF < 0 {
				return nil, erroValidacao("Valor unitário da nota fiscal inválido.")
			}
			itemRecebimento.ValorNFUnitarioCentavos = &valorNF
		}
		itensRecebimento = append(itensRecebimento, itemRecebimento)
		totalRecebido += quantidade * valorUnitario
	}
	if len(itensRecebimento) == 0 {
		return nil, erroValidacao("Informe ao menos um item para o recebimento.")
	}
	recebimento.Itens = itensRecebimento
	statusConferencia := "CONFERIDO"
	divergencias := make([]compras.Divergencia, 0)
	valorRecebidoCentavos := int64(totalRecebido*100 + 0.5)
	if recebimento.ValorNFCentavos != nil && *recebimento.ValorNFCentavos != valorRecebidoCentavos {
		statusConferencia = "PENDENTE"
		divergencias = append(divergencias, compras.Divergencia{Tipo: "VALOR_TOTAL", Esperado: strconv.FormatInt(valorRecebidoCentavos, 10), Encontrado: strconv.FormatInt(*recebimento.ValorNFCentavos, 10), Status: "PENDENTE"})
	}
	for _, item := range itensRecebimento {
		if item.QuantidadeNF != nil && *item.QuantidadeNF != item.Quantidade {
			statusConferencia = "PENDENTE"
			pedidoItemID := item.PedidoItemID
			divergencias = append(divergencias, compras.Divergencia{PedidoItemID: &pedidoItemID, Tipo: "QUANTIDADE", Esperado: formatarNumero(item.Quantidade), Encontrado: formatarNumero(*item.QuantidadeNF), Status: "PENDENTE"})
		}
		valorUnitarioCentavos := int64(item.ValorUnitario*100 + 0.5)
		if item.ValorNFUnitarioCentavos != nil && *item.ValorNFUnitarioCentavos != valorUnitarioCentavos {
			statusConferencia = "PENDENTE"
			pedidoItemID := item.PedidoItemID
			divergencias = append(divergencias, compras.Divergencia{PedidoItemID: &pedidoItemID, Tipo: "VALOR_UNITARIO", Esperado: strconv.FormatInt(valorUnitarioCentavos, 10), Encontrado: strconv.FormatInt(*item.ValorNFUnitarioCentavos, 10), Status: "PENDENTE"})
		}
	}
	recebimento.StatusConferencia = &statusConferencia

	if err := g.Recebimentos.Criar(ctx, recebimento); err != nil {
		return nil, err
	}
	if len(divergencias) > 0 && g.Processos != nil {
		for i := range divergencias {
			divergencias[i].RecebimentoID = recebimento.ID
			divergencias[i].CriadoEm = recebimento.RecebidoEm
		}
		if err := g.Processos.RegistrarDivergencias(ctx, divergencias); err != nil {
			return nil, err
		}
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
			Tipo:          estoque.MovEntrada,
			Quantidade:    item.Quantidade,
			ValorUnitario: &item.ValorUnitario,
			Documento:     recebimento.NotaFiscal,
			Observacao:    &descricao,
			OcorridoEm:    recebimento.RecebidoEm,
			RegistradoPor: &sess.Nome,
			MaterialID:    item.MaterialID,
			FornecedorID:  &pedido.FornecedorID,
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
		Numero:         numConta,
		PedidoID:       &pedido.ID,
		FornecedorID:   pedido.FornecedorID,
		FornecedorNome: pedido.FornecedorNome,
		ValorTotal:     totalRecebido,
		ValorAberto:    totalRecebido,
		Vencimento:     *vencimento,
		Status:         "ABERTA",
		CriadoEm:       recebimento.RecebidoEm,
		Observacao:     recebimento.Observacao,
	}
	if err := g.Contas.Criar(ctx, conta); err != nil {
		return nil, err
	}
	if err := g.Recebimentos.AtualizarContaPagar(ctx, recebimento.ID, conta.ID); err != nil {
		return nil, err
	}
	recebimento.ContaPagarID = &conta.ID
	if g.Financeiro != nil && totalRecebido > 0 && statusConferencia == "CONFERIDO" {
		err := g.Financeiro.CriarTituloCompra(ctx, compras.TituloFinanceiroCompra{
			ChaveOrigem: recebimento.ID, Numero: conta.Numero, FornecedorID: pedido.FornecedorID,
			FornecedorNome: pedido.FornecedorNome, Descricao: "Recebimento " + recebimento.Numero + " / pedido " + pedido.Numero,
			ValorCentavos: int64(totalRecebido*100 + 0.5), Emissao: recebimento.RecebidoEm, Vencimento: *vencimento,
			NotaFiscal: recebimento.NotaFiscal, ChaveNF: recebimento.ChaveNF, EmissaoFiscal: parseDataFiscal(recebimento.DataEmissaoNF), ValorFiscalCentavos: recebimento.ValorNFCentavos,
		})
		if err != nil {
			return nil, fmt.Errorf("integrar Financeiro: %w", err)
		}
	}
	return recebimento, nil
}

func parseDataFiscal(valor *string) *time.Time {
	if valor == nil {
		return nil
	}
	t, err := time.Parse(time.DateOnly, strings.TrimSpace(*valor))
	if err != nil {
		return nil
	}
	return &t
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
