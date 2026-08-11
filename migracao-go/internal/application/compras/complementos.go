package compras

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/estoque"
	"siqueiracampos/servidor/internal/domain/identidade"
)

func (g *GerenciadorProcesso) AnexarDocumento(ctx context.Context, s identidade.Sessao, pedidoID, cotacaoID, tipo, nome, conteudo string) error {
	tipo = strings.ToUpper(strings.TrimSpace(tipo))
	permitido := map[string]bool{"PROPOSTA": true, "PEDIDO": true, "NOTA_FISCAL": true, "COMPROVANTE": true, "OUTRO": true}
	if !permitido[tipo] || strings.TrimSpace(nome) == "" || strings.TrimSpace(conteudo) == "" {
		return fmt.Errorf("documento inválido")
	}
	if len(conteudo) > 8*1024*1024 {
		return fmt.Errorf("documento excede 8 MB")
	}
	if (pedidoID == "") == (cotacaoID == "") {
		return fmt.Errorf("vincule o documento ao pedido ou à cotação")
	}
	return g.Repo.RegistrarDocumento(ctx, &dominio.Documento{PedidoID: strPtr(pedidoID), CotacaoID: strPtr(cotacaoID), Tipo: tipo, Nome: strings.TrimSpace(nome), Conteudo: conteudo, RegistradoPor: s.Nome})
}
func (g *GerenciadorProcesso) ResolverDivergencia(ctx context.Context, s identidade.Sessao, id, decisao, justificativa string) error {
	if !identidade.PodeAprovar(s.Cargo) {
		return fmt.Errorf("seu cargo não resolve divergências fiscais")
	}
	decisao = strings.ToUpper(strings.TrimSpace(decisao))
	justificativa = strings.TrimSpace(justificativa)
	if (decisao != "ACEITA" && decisao != "RECUSADA") || justificativa == "" {
		return fmt.Errorf("decisão e justificativa são obrigatórias")
	}
	todas, err := g.Repo.ListarDivergencias(ctx, "")
	if err != nil {
		return err
	}
	var alvo *dominio.Divergencia
	for i := range todas {
		if todas[i].ID == id {
			alvo = &todas[i]
			break
		}
	}
	if alvo == nil || alvo.Status != "PENDENTE" {
		return fmt.Errorf("divergência não encontrada ou já resolvida")
	}
	if err = g.Repo.ResolverDivergencia(ctx, id, decisao, justificativa, s.Nome); err != nil {
		return err
	}

	divergencias, err := g.Repo.ListarDivergencias(ctx, alvo.RecebimentoID)
	if err != nil {
		return err
	}
	status := "CONFERIDO"
	for _, divergencia := range divergencias {
		if divergencia.Status == "PENDENTE" {
			return nil
		}
		if divergencia.Status == "RECUSADA" {
			status = "RECUSADO"
		}
	}
	if err = g.Pedidos.Recebimentos.AtualizarConferencia(ctx, alvo.RecebimentoID, status); err != nil {
		return err
	}
	if status != "CONFERIDO" || g.Pedidos.Financeiro == nil {
		return nil
	}
	recebimento, err := g.Pedidos.Recebimentos.BuscarPorID(ctx, alvo.RecebimentoID)
	if err != nil {
		return err
	}
	if recebimento == nil {
		return fmt.Errorf("recebimento não encontrado")
	}
	pedido, err := g.Pedidos.Pedidos.BuscarPorID(ctx, recebimento.PedidoID)
	if err != nil {
		return err
	}
	if pedido == nil {
		return fmt.Errorf("pedido não encontrado")
	}
	if recebimento.ContaPagarID == nil {
		return fmt.Errorf("recebimento sem conta a pagar")
	}
	conta, err := g.Pedidos.Contas.BuscarPorID(ctx, *recebimento.ContaPagarID)
	if err != nil {
		return err
	}
	if conta == nil {
		return fmt.Errorf("conta a pagar não encontrada")
	}
	var valor int64
	for _, item := range recebimento.Itens {
		valor += int64(item.Quantidade*item.ValorUnitario*100 + 0.5)
	}
	return g.Pedidos.Financeiro.CriarTituloCompra(ctx, dominio.TituloFinanceiroCompra{ChaveOrigem: recebimento.ID, Numero: conta.Numero, FornecedorID: pedido.FornecedorID, FornecedorNome: pedido.FornecedorNome, Descricao: "Recebimento " + recebimento.Numero + " / pedido " + pedido.Numero, ValorCentavos: valor, Emissao: recebimento.RecebidoEm, Vencimento: conta.Vencimento, NotaFiscal: recebimento.NotaFiscal, ChaveNF: recebimento.ChaveNF, EmissaoFiscal: parseDataFiscal(recebimento.DataEmissaoNF), ValorFiscalCentavos: recebimento.ValorNFCentavos})
}
func (g *GerenciadorProcesso) CriarDevolucao(ctx context.Context, s identidade.Sessao, recebimentoID, fornecedorID, motivo string, itens []dominio.ItemDevolucao) (*dominio.Devolucao, error) {
	if recebimentoID == "" || fornecedorID == "" || strings.TrimSpace(motivo) == "" || len(itens) == 0 {
		return nil, fmt.Errorf("recebimento, fornecedor, motivo e itens são obrigatórios")
	}
	for _, i := range itens {
		if i.MaterialID == "" || i.Quantidade <= 0 || i.ValorUnitarioCentavos < 0 {
			return nil, fmt.Errorf("item de devolução inválido")
		}
	}
	recebimento, err := g.Pedidos.Recebimentos.BuscarPorID(ctx, recebimentoID)
	if err != nil {
		return nil, err
	}
	if recebimento == nil {
		return nil, fmt.Errorf("recebimento não encontrado")
	}
	pedido, err := g.Pedidos.Pedidos.BuscarPorID(ctx, recebimento.PedidoID)
	if err != nil {
		return nil, err
	}
	if pedido == nil || pedido.FornecedorID != fornecedorID {
		return nil, fmt.Errorf("fornecedor não corresponde ao recebimento")
	}
	disponivel := map[string]float64{}
	for _, item := range recebimento.Itens {
		disponivel[item.MaterialID] += item.Quantidade
	}
	anteriores, err := g.Repo.ListarDevolucoes(ctx)
	if err != nil {
		return nil, err
	}
	for _, devolucao := range anteriores {
		if devolucao.RecebimentoID != recebimentoID || devolucao.Status == "CANCELADA" {
			continue
		}
		for _, item := range devolucao.Itens {
			disponivel[item.MaterialID] -= item.Quantidade
		}
	}
	for _, item := range itens {
		if item.Quantidade > disponivel[item.MaterialID]+0.0000001 {
			return nil, fmt.Errorf("quantidade devolvida excede o saldo recebido")
		}
		disponivel[item.MaterialID] -= item.Quantidade
	}
	prefixo := fmt.Sprintf("DEV-%d-", time.Now().Year())
	ultimo, err := g.Repo.UltimoNumeroDevolucao(ctx, prefixo)
	if err != nil {
		return nil, err
	}
	d := &dominio.Devolucao{Numero: proximoNumero(prefixo, ultimo), RecebimentoID: recebimentoID, FornecedorID: fornecedorID, Motivo: strings.TrimSpace(motivo), Status: "REGISTRADA", RegistradoPor: s.Nome, Itens: itens}
	if err = g.Repo.CriarDevolucao(ctx, d); err != nil {
		return nil, err
	}
	if g.Movimentacoes != nil {
		descricao := "Devolução ao fornecedor " + d.Numero + ": " + d.Motivo
		for _, item := range d.Itens {
			valor := float64(item.ValorUnitarioCentavos) / 100
			movimento := &estoque.Movimentacao{Tipo: estoque.MovSaida, Quantidade: item.Quantidade, ValorUnitario: &valor, Observacao: &descricao, OcorridoEm: time.Now(), RegistradoPor: &s.Nome, MaterialID: item.MaterialID, FornecedorID: &d.FornecedorID}
			if err := g.Movimentacoes.Criar(ctx, movimento); err != nil {
				return nil, fmt.Errorf("baixar devolução no estoque: %w", err)
			}
		}
	}
	return d, nil
}
func (g *GerenciadorProcesso) CriarContrato(ctx context.Context, s identidade.Sessao, e EntradaContrato) (*dominio.Contrato, error) {
	if !identidade.PodeAprovar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não cria contratos")
	}
	inicio, err := time.Parse(time.DateOnly, e.Inicio)
	if err != nil {
		return nil, fmt.Errorf("início inválido")
	}
	fim, err := dataOpcional(e.Fim)
	if err != nil {
		return nil, err
	}
	if fim != nil && fim.Before(inicio) {
		return nil, fmt.Errorf("fim anterior ao início")
	}
	if e.Numero == "" || e.FornecedorID == "" || e.FornecedorNome == "" || strings.TrimSpace(e.Objeto) == "" {
		return nil, fmt.Errorf("número, fornecedor e objeto são obrigatórios")
	}
	c := &dominio.Contrato{Numero: e.Numero, FornecedorID: e.FornecedorID, FornecedorNome: e.FornecedorNome, Objeto: strings.TrimSpace(e.Objeto), Inicio: inicio, Fim: fim, Periodicidade: e.Periodicidade, CondicaoPagamento: strPtr(e.CondicaoPagamento), Observacao: strPtr(e.Observacao), Ativo: true, CriadoPor: s.Nome}
	if e.ValorLimiteCentavos != "" {
		v, x := strconv.ParseInt(e.ValorLimiteCentavos, 10, 64)
		if x != nil || v <= 0 {
			return nil, fmt.Errorf("limite inválido")
		}
		c.ValorLimiteCentavos = &v
	}
	c.ProximaGeracao, err = dataOpcional(e.ProximaGeracao)
	if err != nil {
		return nil, err
	}
	if err = g.Repo.CriarContrato(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}
func (g *GerenciadorProcesso) Avaliar(ctx context.Context, s identidade.Sessao, fornecedorID, pedidoID string, prazo, qualidade, atendimento int, observacao string) error {
	if fornecedorID == "" || pedidoID == "" || prazo < 1 || prazo > 5 || qualidade < 1 || qualidade > 5 || atendimento < 1 || atendimento > 5 {
		return fmt.Errorf("avaliação inválida")
	}
	return g.Repo.AvaliarFornecedor(ctx, &dominio.AvaliacaoFornecedor{FornecedorID: fornecedorID, PedidoID: strPtr(pedidoID), Prazo: prazo, Qualidade: qualidade, Atendimento: atendimento, Observacao: strPtr(observacao), AvaliadoPor: s.Nome})
}
