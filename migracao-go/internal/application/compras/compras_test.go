package compras

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/estoque"
	"siqueiracampos/servidor/internal/domain/identidade"
)

type pedidosFake struct {
	porID  map[string]*dominio.PedidoCompra
	ultimo string
}

func (f *pedidosFake) BuscarPorID(_ context.Context, id string) (*dominio.PedidoCompra, error) {
	return f.porID[id], nil
}
func (f *pedidosFake) Listar(context.Context) ([]dominio.PedidoCompra, error) { return nil, nil }
func (f *pedidosFake) UltimoNumero(context.Context, string) (string, error)   { return f.ultimo, nil }
func (f *pedidosFake) Criar(_ context.Context, p *dominio.PedidoCompra) error {
	p.ID = "pedido-1"
	for i := range p.Itens {
		p.Itens[i].ID = fmt.Sprintf("item-%d", i+1)
		p.Itens[i].PedidoID = p.ID
	}
	f.porID[p.ID] = p
	return nil
}
func (f *pedidosFake) AtualizarStatus(_ context.Context, id string, status dominio.StatusPedidoCompra, _ *string, total float64) error {
	f.porID[id].Status = status
	f.porID[id].TotalRecebido += total
	return nil
}
func (f *pedidosFake) AtualizarItemRecebido(_ context.Context, itemID string, qtd float64) error {
	// O gerenciador atualiza também o agregado carregado logo depois de persistir. O fake
	// guarda esse mesmo ponteiro, portanto a mutação em memória representa a persistência.
	return nil
}

type recebimentosFake struct{ criados []*dominio.RecebimentoCompra }

func (f *recebimentosFake) UltimoNumero(context.Context, string) (string, error) { return "", nil }
func (f *recebimentosFake) BuscarPorID(_ context.Context, id string) (*dominio.RecebimentoCompra, error) {
	for _, r := range f.criados {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, nil
}
func (f *recebimentosFake) Listar(context.Context) ([]dominio.RecebimentoCompra, error) {
	resultado := make([]dominio.RecebimentoCompra, len(f.criados))
	for i, r := range f.criados {
		resultado[i] = *r
	}
	return resultado, nil
}
func (f *recebimentosFake) BuscarPorChave(_ context.Context, chave string) (*dominio.RecebimentoCompra, error) {
	for _, r := range f.criados {
		if r.ChaveIdempotencia != nil && *r.ChaveIdempotencia == chave {
			return r, nil
		}
	}
	return nil, nil
}
func (f *recebimentosFake) Criar(_ context.Context, r *dominio.RecebimentoCompra) error {
	r.ID = fmt.Sprintf("rec-%d", len(f.criados)+1)
	f.criados = append(f.criados, r)
	return nil
}
func (f *recebimentosFake) AtualizarContaPagar(_ context.Context, recebimentoID, contaID string) error {
	for _, r := range f.criados {
		if r.ID == recebimentoID {
			r.ContaPagarID = &contaID
		}
	}
	return nil
}
func (f *recebimentosFake) AtualizarConferencia(_ context.Context, recebimentoID, status string) error {
	for _, r := range f.criados {
		if r.ID == recebimentoID {
			r.StatusConferencia = &status
		}
	}
	return nil
}

type contasFake struct{ criadas []*dominio.ContaPagar }

func (f *contasFake) BuscarPorID(_ context.Context, id string) (*dominio.ContaPagar, error) {
	for _, c := range f.criadas {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, nil
}
func (f *contasFake) UltimoNumero(context.Context, string) (string, error)        { return "", nil }
func (f *contasFake) ListarAbertas(context.Context) ([]dominio.ContaPagar, error) { return nil, nil }
func (f *contasFake) Criar(_ context.Context, c *dominio.ContaPagar) error {
	c.ID = fmt.Sprintf("conta-%d", len(f.criadas)+1)
	f.criadas = append(f.criadas, c)
	return nil
}

type fornecedoresFake struct {
	porID map[string]*cadastro.Fornecedor
}

func (f *fornecedoresFake) BuscarPorID(_ context.Context, id string) (*cadastro.Fornecedor, error) {
	return f.porID[id], nil
}
func (f *fornecedoresFake) ListarAtivos(context.Context) ([]cadastro.Fornecedor, error) {
	return nil, nil
}

type solicitacoesFake struct {
	porID map[string]*estoque.SolicitacaoCompra
}

func (f *solicitacoesFake) BuscarPorID(_ context.Context, id string) (*estoque.SolicitacaoCompra, error) {
	return f.porID[id], nil
}
func (f *solicitacoesFake) Listar(context.Context) ([]estoque.SolicitacaoCompra, error) {
	return nil, nil
}

type materiaisFake struct{}

func (*materiaisFake) BuscarPorID(context.Context, string) (*estoque.Material, error) {
	return nil, nil
}

type movimentacoesFake struct{ criadas []estoque.Movimentacao }

func (f *movimentacoesFake) Criar(_ context.Context, m *estoque.Movimentacao) error {
	m.ID = fmt.Sprintf("mov-%d", len(f.criadas)+1)
	f.criadas = append(f.criadas, *m)
	return nil
}

type processosCaptura struct {
	dominio.ProcessoRepositorio
	divergencias []dominio.Divergencia
}

func (p *processosCaptura) RegistrarDivergencias(_ context.Context, divergencias []dominio.Divergencia) error {
	p.divergencias = append(p.divergencias, divergencias...)
	return nil
}

func novoGerenciadorTeste() (*Gerenciador, *pedidosFake, *recebimentosFake, *contasFake, *movimentacoesFake) {
	preco := 12.5
	s := &estoque.SolicitacaoCompra{ID: "sol-1", Status: estoque.StatusEnviada, Itens: []estoque.ItemSolicitacao{{MaterialID: "mat-1", MaterialCodigo: "MAT-001", MaterialNome: "Cimento", MaterialUnidade: "SC", Quantidade: 10, PrecoEstimado: &preco}}}
	p := &pedidosFake{porID: map[string]*dominio.PedidoCompra{}}
	r := &recebimentosFake{}
	c := &contasFake{}
	m := &movimentacoesFake{}
	g := &Gerenciador{Pedidos: p, Recebimentos: r, Contas: c, Fornecedores: &fornecedoresFake{porID: map[string]*cadastro.Fornecedor{"for-1": {ID: "for-1", Nome: "Fornecedor", Ativo: true}}}, Solicitacoes: &solicitacoesFake{porID: map[string]*estoque.SolicitacaoCompra{"sol-1": s}}, Materiais: &materiaisFake{}, Movimentacoes: m}
	return g, p, r, c, m
}

func TestCriarPedidoCopiaItensENasceAberto(t *testing.T) {
	g, pedidos, _, _, _ := novoGerenciadorTeste()
	p, err := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	if err != nil {
		t.Fatal(err)
	}
	if p.Status != dominio.StatusPedidoRascunho || len(p.Itens) != 1 || p.TotalEstimado != 125 {
		t.Fatalf("pedido inesperado: %+v", p)
	}
	if pedidos.porID[p.ID] == nil {
		t.Fatal("pedido não foi persistido")
	}
}

func TestCriarPedidoRecusaFornecedorInativo(t *testing.T) {
	g, _, _, _, _ := novoGerenciadorTeste()
	g.Fornecedores = &fornecedoresFake{porID: map[string]*cadastro.Fornecedor{"for-1": {ID: "for-1", Ativo: false}}}
	_, err := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	if err == nil || !strings.Contains(err.Error(), "inativo") {
		t.Fatalf("esperava erro de fornecedor inativo, recebeu %v", err)
	}
}

func TestRecebimentoParcialECompletoGeramEstoqueEContas(t *testing.T) {
	g, pedidos, recebimentos, contas, movs := novoGerenciadorTeste()
	p, err := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	if err != nil {
		t.Fatal(err)
	}
	p.Status = dominio.StatusPedidoEnviado
	sess := identidade.Sessao{Nome: "Comprador"}
	primeiro, err := g.RegistrarRecebimento(context.Background(), sess, EntradaRecebimento{PedidoID: p.ID, ChaveIdempotencia: "rec-1", Itens: []ItemRecebimentoEntrada{{PedidoItemID: p.Itens[0].ID, Quantidade: "4", ValorUnitario: "13,50"}}})
	if err != nil {
		t.Fatal(err)
	}
	if pedidos.porID[p.ID].Status != dominio.StatusPedidoParcial {
		t.Fatalf("status após parcial: %s", pedidos.porID[p.ID].Status)
	}
	if len(movs.criadas) != 1 || movs.criadas[0].Tipo != estoque.MovEntrada || movs.criadas[0].Quantidade != 4 {
		t.Fatalf("entrada inesperada: %+v", movs.criadas)
	}
	if len(contas.criadas) != 1 || contas.criadas[0].ValorTotal != 54 || primeiro.ContaPagarID == nil {
		t.Fatalf("conta do parcial inesperada: %+v", contas.criadas)
	}

	_, err = g.RegistrarRecebimento(context.Background(), sess, EntradaRecebimento{PedidoID: p.ID, ChaveIdempotencia: "rec-2", Vencimento: "31/12/2030", Itens: []ItemRecebimentoEntrada{{PedidoItemID: p.Itens[0].ID, Quantidade: "6", ValorUnitario: "14"}}})
	if err != nil {
		t.Fatal(err)
	}
	if pedidos.porID[p.ID].Status != dominio.StatusPedidoRecebido {
		t.Fatalf("status final: %s", pedidos.porID[p.ID].Status)
	}
	if len(recebimentos.criados) != 2 || len(movs.criadas) != 2 || len(contas.criadas) != 2 || contas.criadas[1].ValorTotal != 84 {
		t.Fatalf("efeitos finais incorretos")
	}
	if contas.criadas[1].Vencimento.Format("02/01/2006") != "31/12/2030" {
		t.Fatalf("vencimento: %v", contas.criadas[1].Vencimento)
	}
}

func TestRecebimentoRecusaQuantidadeAcimaDoRestante(t *testing.T) {
	g, _, recebimentos, contas, movs := novoGerenciadorTeste()
	p, _ := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	p.Status = dominio.StatusPedidoEnviado
	_, err := g.RegistrarRecebimento(context.Background(), identidade.Sessao{Nome: "X"}, EntradaRecebimento{PedidoID: p.ID, ChaveIdempotencia: "rec-excede", Itens: []ItemRecebimentoEntrada{{PedidoItemID: p.Itens[0].ID, Quantidade: "11", ValorUnitario: "1"}}})
	if err == nil || !strings.Contains(err.Error(), "restante") {
		t.Fatalf("esperava erro de saldo restante, recebeu %v", err)
	}
	if len(recebimentos.criados)+len(contas.criadas)+len(movs.criadas) != 0 {
		t.Fatal("validação não pode produzir efeitos")
	}
}

func TestRecebimentoSemVencimentoUsaTrintaDias(t *testing.T) {
	g, _, recebimentos, contas, _ := novoGerenciadorTeste()
	p, _ := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	p.Status = dominio.StatusPedidoEnviado
	r, err := g.RegistrarRecebimento(context.Background(), identidade.Sessao{Nome: "X"}, EntradaRecebimento{PedidoID: p.ID, ChaveIdempotencia: "rec-parcial", Itens: []ItemRecebimentoEntrada{{PedidoItemID: p.Itens[0].ID, Quantidade: "1", ValorUnitario: "1"}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(recebimentos.criados) != 1 || len(contas.criadas) != 1 {
		t.Fatal("efeitos ausentes")
	}
	esperado := r.RecebidoEm.AddDate(0, 0, 30).Format(time.DateOnly)
	if contas.criadas[0].Vencimento.Format(time.DateOnly) != esperado {
		t.Fatalf("vencimento = %s, esperado %s", contas.criadas[0].Vencimento.Format(time.DateOnly), esperado)
	}
}

func TestRecebimentoFiscalDetectaDivergenciaEEhIdempotente(t *testing.T) {
	g, _, recebimentos, contas, movs := novoGerenciadorTeste()
	processos := &processosCaptura{}
	g.Processos = processos
	pedido, _ := g.CriarPedido(context.Background(), identidade.Sessao{}, EntradaPedido{SolicitacaoID: "sol-1", FornecedorID: "for-1"})
	pedido.Status = dominio.StatusPedidoEnviado
	entrada := EntradaRecebimento{PedidoID: pedido.ID, ChaveIdempotencia: "nf-empotente", ChaveNF: "35260800000000000000550010000000011000000010", ValorNFCentavos: "1300", Itens: []ItemRecebimentoEntrada{{PedidoItemID: pedido.Itens[0].ID, Quantidade: "1", ValorUnitario: "12,50", QuantidadeNF: "2", ValorNFUnitarioCentavos: "1300"}}}

	primeiro, err := g.RegistrarRecebimento(context.Background(), identidade.Sessao{Nome: "Comprador"}, entrada)
	if err != nil {
		t.Fatal(err)
	}
	if primeiro.StatusConferencia == nil || *primeiro.StatusConferencia != "PENDENTE" {
		t.Fatalf("conferência: %+v", primeiro.StatusConferencia)
	}
	if len(processos.divergencias) != 3 {
		t.Fatalf("divergências: %+v", processos.divergencias)
	}
	segundo, err := g.RegistrarRecebimento(context.Background(), identidade.Sessao{Nome: "Comprador"}, entrada)
	if err != nil {
		t.Fatalf("retentativa: %v", err)
	}
	if segundo.ID != primeiro.ID || len(recebimentos.criados) != 1 || len(contas.criadas) != 1 || len(movs.criadas) != 1 {
		t.Fatal("retentativa duplicou efeitos")
	}
}
