package alojamentos

import "testing"

func TestConversaWhatsappCriaPedidoAposConfirmacao(t *testing.T) {
	_, a := ProximoPasso(nil, "oi", "Maria Silva", "Central")
	_, a = ProximoPasso(a.Estado, "2", "Maria Silva", "Central")
	_, a = ProximoPasso(a.Estado, "A torneira do quarto está vazando", "Maria Silva", "Central")
	resposta, a := ProximoPasso(a.Estado, "sim", "Maria Silva", "Central")
	if resposta != "" || a.Pedido == nil || a.Pedido.Tipo != "MANUTENCAO" || !a.Limpar {
		t.Fatalf("confirmação inválida: resposta=%q ação=%+v", resposta, a)
	}
}

func TestMensagemDeGrupoSoAceitaGatilho(t *testing.T) {
	if PedidoDeGrupo("bom dia pessoal") != nil {
		t.Fatal("conversa comum não pode virar pedido")
	}
	p := PedidoDeGrupo("#pedido limpeza lixo acumulado na cozinha")
	if p == nil || p.Tipo != "LIMPEZA" {
		t.Fatalf("pedido não classificado: %+v", p)
	}
}
