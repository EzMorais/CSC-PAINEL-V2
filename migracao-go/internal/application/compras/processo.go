package compras

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorProcesso struct {
	Repo          dominio.ProcessoRepositorio
	Pedidos       *Gerenciador
	Movimentacoes dominio.MovimentacaoRepositorio
}
type EntradaCotacao struct {
	SolicitacaoID, PrazoResposta, Observacao string
	Fornecedores                             []string
}
type EntradaItemProposta struct{ MaterialID, Quantidade, ValorUnitarioCentavos, Marca, Observacao string }
type EntradaProposta struct {
	CotacaoID, FornecedorID, FreteCentavos, PrazoDias, PrevisaoEntrega, CondicaoPagamento, Validade, Observacao, Anexo string
	Itens                                                                                                              []EntradaItemProposta
}
type EntradaContrato struct{ Numero, FornecedorID, FornecedorNome, Objeto, Inicio, Fim, ValorLimiteCentavos, Periodicidade, ProximaGeracao, CondicaoPagamento, Observacao string }

func dataOpcional(v string) (*time.Time, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, nil
	}
	t, e := time.Parse(time.DateOnly, v)
	if e != nil {
		return nil, fmt.Errorf("data inválida")
	}
	return &t, nil
}
func inteiro64(v string) (int64, error) {
	n, e := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
	if e != nil {
		return 0, fmt.Errorf("valor em centavos inválido")
	}
	return n, nil
}

func (g *GerenciadorProcesso) CriarCotacao(ctx context.Context, s identidade.Sessao, e EntradaCotacao) (*dominio.Cotacao, error) {
	if strings.TrimSpace(e.SolicitacaoID) == "" {
		return nil, fmt.Errorf("solicitação é obrigatória")
	}
	unicos := map[string]bool{}
	var fs []string
	for _, id := range e.Fornecedores {
		id = strings.TrimSpace(id)
		if id != "" && !unicos[id] {
			unicos[id] = true
			fs = append(fs, id)
		}
	}
	if len(fs) < 2 {
		return nil, fmt.Errorf("convide ao menos dois fornecedores")
	}
	prazo, err := dataOpcional(e.PrazoResposta)
	if err != nil {
		return nil, err
	}
	prefixo := fmt.Sprintf("COT-%d-", time.Now().Year())
	ultimo, err := g.Repo.UltimoNumeroCotacao(ctx, prefixo)
	if err != nil {
		return nil, err
	}
	c := &dominio.Cotacao{Numero: proximoNumero(prefixo, ultimo), SolicitacaoID: e.SolicitacaoID, Status: dominio.CotacaoAberta, PrazoResposta: prazo, Observacao: strPtr(e.Observacao), SolicitanteID: s.ID, SolicitanteNome: s.Nome, CriadoEm: time.Now().UTC()}
	if err = g.Repo.CriarCotacao(ctx, c, fs); err != nil {
		return nil, err
	}
	return c, nil
}

func (g *GerenciadorProcesso) RegistrarProposta(ctx context.Context, s identidade.Sessao, e EntradaProposta) (*dominio.Proposta, error) {
	if e.CotacaoID == "" || e.FornecedorID == "" || len(e.Itens) == 0 {
		return nil, fmt.Errorf("cotação, fornecedor e itens são obrigatórios")
	}
	c, err := g.Repo.BuscarCotacao(ctx, e.CotacaoID)
	if err != nil {
		return nil, err
	}
	if c == nil || c.Status == dominio.CotacaoSelecionada || c.Status == dominio.CotacaoCancelada {
		return nil, fmt.Errorf("cotação não aceita proposta")
	}
	var nome string
	for _, f := range c.Fornecedores {
		if f.FornecedorID == e.FornecedorID {
			nome = f.FornecedorNome
		}
	}
	if nome == "" {
		return nil, fmt.Errorf("fornecedor não foi convidado")
	}
	p := &dominio.Proposta{CotacaoID: e.CotacaoID, FornecedorID: e.FornecedorID, FornecedorNome: nome, CondicaoPagamento: strPtr(e.CondicaoPagamento), Observacao: strPtr(e.Observacao), Anexo: strPtr(e.Anexo), RegistradoPor: s.Nome, CriadoEm: time.Now().UTC()}
	p.PrevisaoEntrega, err = dataOpcional(e.PrevisaoEntrega)
	if err != nil {
		return nil, err
	}
	if d, _ := dataOpcional(e.Validade); d != nil {
		v := d.Format(time.DateOnly)
		p.Validade = &v
	}
	if strings.TrimSpace(e.PrazoDias) != "" {
		n, x := strconv.Atoi(e.PrazoDias)
		if x != nil || n < 0 {
			return nil, fmt.Errorf("prazo inválido")
		}
		p.PrazoDias = &n
	}
	p.FreteCentavos, err = inteiro64(zeroSeVazio(e.FreteCentavos))
	if err != nil || p.FreteCentavos < 0 {
		return nil, fmt.Errorf("frete inválido")
	}
	for _, i := range e.Itens {
		q, x := strconv.ParseFloat(strings.ReplaceAll(i.Quantidade, ",", "."), 64)
		v, y := inteiro64(i.ValorUnitarioCentavos)
		if x != nil || y != nil || q <= 0 || v < 0 {
			return nil, fmt.Errorf("item da proposta inválido")
		}
		p.Itens = append(p.Itens, dominio.ItemProposta{MaterialID: i.MaterialID, Quantidade: q, ValorUnitarioCentavos: v, Marca: strPtr(i.Marca), Observacao: strPtr(i.Observacao)})
		p.ValorItensCentavos += int64(q*float64(v) + 0.5)
	}
	p.TotalCentavos = p.ValorItensCentavos + p.FreteCentavos
	if p.TotalCentavos <= 0 {
		return nil, fmt.Errorf("total da proposta deve ser positivo")
	}
	if err = g.Repo.RegistrarProposta(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}
func zeroSeVazio(v string) string {
	if strings.TrimSpace(v) == "" {
		return "0"
	}
	return v
}

func (g *GerenciadorProcesso) SelecionarPropostaECriarPedido(ctx context.Context, s identidade.Sessao, cotacaoID, propostaID, motivo string) (*dominio.PedidoCompra, error) {
	c, err := g.Repo.BuscarCotacao(ctx, cotacaoID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("cotação não encontrada")
	}
	motivo = strings.TrimSpace(motivo)
	if motivo == "" {
		return nil, fmt.Errorf("justifique a escolha da proposta")
	}
	var p *dominio.Proposta
	for i := range c.Propostas {
		if c.Propostas[i].ID == propostaID {
			p = &c.Propostas[i]
		}
	}
	if p == nil {
		return nil, fmt.Errorf("proposta não encontrada")
	}
	if err = g.Repo.SelecionarProposta(ctx, cotacaoID, propostaID, motivo, s.ID, s.Nome); err != nil {
		return nil, err
	}
	condicao := ""
	if p.CondicaoPagamento != nil {
		condicao = *p.CondicaoPagamento
	}
	pedido, err := g.Pedidos.CriarPedido(ctx, s, EntradaPedido{SolicitacaoID: c.SolicitacaoID, FornecedorID: p.FornecedorID, CotacaoID: c.ID, MotivoEscolha: motivo, Observacao: condicao})
	if err != nil {
		return nil, err
	}
	return pedido, nil
}

func (g *GerenciadorProcesso) EnviarParaAprovacao(ctx context.Context, s identidade.Sessao, p *dominio.PedidoCompra) error {
	if p.Status != dominio.StatusPedidoRascunho {
		return fmt.Errorf("somente rascunho pode ir para aprovação")
	}
	return g.Repo.AtualizarFluxoPedido(ctx, p.ID, p.Status, dominio.StatusPedidoPendente, s.ID, s.Nome, "")
}

func (g *GerenciadorProcesso) EditarRascunho(ctx context.Context, p *dominio.PedidoCompra, fornecedorID, observacao, previsaoEntrega, condicaoPagamento string) error {
	if p == nil || p.Status != dominio.StatusPedidoRascunho {
		return fmt.Errorf("somente rascunho pode ser editado")
	}
	fornecedor, err := g.Pedidos.Fornecedores.BuscarPorID(ctx, strings.TrimSpace(fornecedorID))
	if err != nil {
		return err
	}
	if fornecedor == nil || !fornecedor.Ativo {
		return fmt.Errorf("fornecedor inválido ou inativo")
	}
	previsao, err := dataOpcional(previsaoEntrega)
	if err != nil {
		return err
	}
	p.FornecedorID, p.FornecedorNome = fornecedor.ID, fornecedor.Nome
	p.Observacao, p.PrevisaoEntrega, p.CondicaoPagamento = strPtr(observacao), previsao, strPtr(condicaoPagamento)
	return g.Repo.AtualizarDadosPedido(ctx, p)
}
func (g *GerenciadorProcesso) Aprovar(ctx context.Context, s identidade.Sessao, p *dominio.PedidoCompra) error {
	if !identidade.PodeAprovar(s.Cargo) {
		return fmt.Errorf("seu cargo não aprova pedidos")
	}
	if p.Status != dominio.StatusPedidoPendente {
		return fmt.Errorf("pedido não aguarda aprovação")
	}
	if p.SolicitanteID == s.ID {
		return fmt.Errorf("quem solicitou não pode aprovar o próprio pedido")
	}
	return g.Repo.AtualizarFluxoPedido(ctx, p.ID, p.Status, dominio.StatusPedidoAprovado, s.ID, s.Nome, "")
}
func (g *GerenciadorProcesso) Rejeitar(ctx context.Context, s identidade.Sessao, p *dominio.PedidoCompra, motivo string) error {
	if !identidade.PodeAprovar(s.Cargo) || p.Status != dominio.StatusPedidoPendente {
		return fmt.Errorf("pedido não pode ser rejeitado")
	}
	if strings.TrimSpace(motivo) == "" {
		return fmt.Errorf("informe o motivo")
	}
	return g.Repo.AtualizarFluxoPedido(ctx, p.ID, p.Status, dominio.StatusPedidoRejeitado, s.ID, s.Nome, motivo)
}
func (g *GerenciadorProcesso) MarcarEnviado(ctx context.Context, s identidade.Sessao, p *dominio.PedidoCompra) error {
	if p.Status != dominio.StatusPedidoAprovado {
		return fmt.Errorf("somente pedido aprovado pode ser enviado")
	}
	return g.Repo.AtualizarFluxoPedido(ctx, p.ID, p.Status, dominio.StatusPedidoEnviado, s.ID, s.Nome, "")
}
func (g *GerenciadorProcesso) Cancelar(ctx context.Context, s identidade.Sessao, p *dominio.PedidoCompra, motivo string) error {
	if p.Status == dominio.StatusPedidoRecebido || p.Status == dominio.StatusPedidoCancelado {
		return fmt.Errorf("pedido não pode ser cancelado")
	}
	if p.SolicitanteID != s.ID && !identidade.PodeAprovar(s.Cargo) {
		return fmt.Errorf("sem permissão para cancelar")
	}
	if strings.TrimSpace(motivo) == "" {
		return fmt.Errorf("informe o motivo")
	}
	return g.Repo.AtualizarFluxoPedido(ctx, p.ID, p.Status, dominio.StatusPedidoCancelado, s.ID, s.Nome, motivo)
}
