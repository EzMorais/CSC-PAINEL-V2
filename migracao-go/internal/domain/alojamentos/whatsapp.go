package alojamentos

import (
	"context"
	"strings"
	"time"
	"unicode"
)

type MoradorWhatsapp struct{ AlocacaoID, Nome, AlojamentoID, AlojamentoNome string }
type WhatsappRepositorio interface {
	RegistrarMensagem(context.Context, string, string, *string, string) (bool, error)
	BuscarMoradorPorTelefone(context.Context, string) (*MoradorWhatsapp, error)
	BuscarAlojamentoPorGrupo(context.Context, string) (*Alojamento, error)
	BuscarConversa(context.Context, string, time.Time) (*EstadoConversa, error)
	SalvarConversa(context.Context, string, string, *EstadoConversa, time.Time) error
	LimparConversa(context.Context, string) error
}

const (
	PassoTipo      = "AGUARDANDO_TIPO"
	PassoDescricao = "AGUARDANDO_DESCRICAO"
	PassoConfirmar = "AGUARDANDO_CONFIRMACAO"
)

type EstadoConversa struct{ Passo, Tipo, Descricao string }
type AcaoConversa struct {
	Estado *EstadoConversa
	Limpar bool
	Pedido *Pedido
}

func normalizar(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		switch r {
		case 'á', 'à', 'ã', 'â':
			r = 'a'
		case 'é', 'ê':
			r = 'e'
		case 'í':
			r = 'i'
		case 'ó', 'ô', 'õ':
			r = 'o'
		case 'ú', 'ü':
			r = 'u'
		case 'ç':
			r = 'c'
		}
		if !unicode.IsControl(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func tituloPedido(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if len([]rune(s)) <= 80 {
		return s
	}
	r := []rune(s)[:80]
	if i := strings.LastIndex(string(r), " "); i > 40 {
		r = []rune(string(r)[:i])
	}
	return strings.TrimSpace(string(r)) + "…"
}

func ProximoPasso(estado *EstadoConversa, texto, nome, alojamento string) (string, AcaoConversa) {
	t := normalizar(texto)
	if t == "cancelar" || t == "sair" || t == "parar" || t == "nao" {
		return "Tudo bem, cancelei. Quando precisar, é só mandar mensagem de novo.", AcaoConversa{Limpar: true}
	}
	if estado == nil || t == "menu" || t == "voltar" || t == "oi" || t == "ola" || t == "bom dia" || t == "boa tarde" || t == "boa noite" {
		primeiro := strings.Fields(nome)
		saudacao := nome
		if len(primeiro) > 0 {
			saudacao = primeiro[0]
		}
		return "Olá, " + saudacao + "! Alojamento " + alojamento + ".\n\nO que você precisa?\n1 - Limpeza\n2 - Manutenção\n3 - Pessoal\n\nResponda com o número da opção.", AcaoConversa{Estado: &EstadoConversa{Passo: PassoTipo}}
	}
	if estado.Passo == PassoTipo {
		tipos := map[string]string{"1": "LIMPEZA", "2": "MANUTENCAO", "3": "PESSOAL"}
		tipo := tipos[t]
		if tipo == "" {
			return "Não entendi. Responda com 1, 2 ou 3.", AcaoConversa{}
		}
		return "Agora conte o que você precisa, em uma mensagem.", AcaoConversa{Estado: &EstadoConversa{Passo: PassoDescricao, Tipo: tipo}}
	}
	if estado.Passo == PassoDescricao {
		d := strings.TrimSpace(texto)
		if len([]rune(d)) < 5 {
			return "Pode explicar um pouco mais?", AcaoConversa{}
		}
		return "Confere para mim:\n\n" + d + "\n\nEstá certo? Responda sim para registrar, ou não para cancelar.", AcaoConversa{Estado: &EstadoConversa{Passo: PassoConfirmar, Tipo: estado.Tipo, Descricao: d}}
	}
	if estado.Passo == PassoConfirmar && (t == "sim" || t == "s" || t == "ok" || t == "confirmo" || t == "certo") {
		d := estado.Descricao
		p := &Pedido{Tipo: estado.Tipo, Titulo: tituloPedido(d), Prioridade: "NORMAL", Origem: "WHATSAPP"}
		if len([]rune(d)) > 80 {
			p.Descricao = &d
		}
		return "", AcaoConversa{Pedido: p, Limpar: true}
	}
	return "Não registrei. Escreva de novo o que você precisa, ou mande menu para recomeçar.", AcaoConversa{Estado: &EstadoConversa{Passo: PassoDescricao, Tipo: estado.Tipo}}
}

func PedidoDeGrupo(texto string) *Pedido {
	b := strings.TrimSpace(texto)
	n := normalizar(b)
	gatilho := ""
	for _, g := range []string{"#pedido", "pedido:"} {
		if strings.HasPrefix(n, g) {
			gatilho = g
			break
		}
	}
	if gatilho == "" {
		return nil
	}
	corpo := strings.TrimSpace(b[len(gatilho):])
	corpo = strings.TrimLeft(corpo, ":- ")
	if len([]rune(corpo)) < 5 {
		return nil
	}
	tipo := "MANUTENCAO"
	alvo := normalizar(corpo)
	if strings.Contains(alvo, "limpeza") || strings.Contains(alvo, "limpar") || strings.Contains(alvo, "lixo") {
		tipo = "LIMPEZA"
	}
	if strings.Contains(alvo, "pessoal") || strings.Contains(alvo, "cama") || strings.Contains(alvo, "quarto") {
		tipo = "PESSOAL"
	}
	p := &Pedido{Tipo: tipo, Titulo: tituloPedido(corpo), Prioridade: "NORMAL", Origem: "WHATSAPP"}
	if len([]rune(corpo)) > 80 {
		p.Descricao = &corpo
	}
	return p
}
