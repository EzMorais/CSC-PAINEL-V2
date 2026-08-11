package alojamentos

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/alojamentos"
	"siqueiracampos/servidor/internal/services/integracao"
)

type mensagemWhatsapp struct {
	Telefone      string  `json:"telefone"`
	Texto         string  `json:"texto"`
	MensagemID    string  `json:"mensagemId"`
	GrupoID       *string `json:"grupoId"`
	NomeRemetente *string `json:"nomeRemetente"`
}

func jsonResposta(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *Handlers) WhatsappRecebida(w http.ResponseWriter, r *http.Request) {
	if h.Integracao == nil {
		jsonResposta(w, 500, map[string]string{"erro": "integração não configurada"})
		return
	}
	if origem, ok := h.Integracao.Verificar(r.Header.Get("Authorization")); !ok || origem != "whatsapp" {
		jsonResposta(w, 401, map[string]string{"erro": "Token de integração ausente ou inválido."})
		return
	}
	var c mensagemWhatsapp
	if json.NewDecoder(r.Body).Decode(&c) != nil || strings.TrimSpace(c.Telefone) == "" || strings.TrimSpace(c.Texto) == "" {
		jsonResposta(w, 400, map[string]string{"erro": "Informe telefone e texto."})
		return
	}
	duplicada, err := h.Whatsapp.RegistrarMensagem(r.Context(), c.MensagemID, c.Telefone, c.GrupoID, c.Texto)
	if err != nil {
		jsonResposta(w, 500, map[string]string{"erro": err.Error()})
		return
	}
	if duplicada {
		jsonResposta(w, 200, map[string]any{"resposta": nil})
		return
	}
	if c.GrupoID != nil && strings.TrimSpace(*c.GrupoID) != "" {
		h.whatsappGrupo(w, r, c)
		return
	}
	m, err := h.Whatsapp.BuscarMoradorPorTelefone(r.Context(), c.Telefone)
	if err != nil {
		jsonResposta(w, 500, map[string]string{"erro": err.Error()})
		return
	}
	if m == nil {
		jsonResposta(w, 200, map[string]string{"resposta": "Olá! Não encontrei o seu número no cadastro dos alojamentos. Procure o responsável para cadastrar seu WhatsApp."})
		return
	}
	estado, _ := h.Whatsapp.BuscarConversa(r.Context(), c.Telefone, time.Now().UTC())
	resposta, acao := dominio.ProximoPasso(estado, c.Texto, m.Nome, m.AlojamentoNome)
	if acao.Estado != nil {
		err = h.Whatsapp.SalvarConversa(r.Context(), c.Telefone, m.AlocacaoID, acao.Estado, time.Now().UTC().Add(30*time.Minute))
	}
	if acao.Limpar {
		err = h.Whatsapp.LimparConversa(r.Context(), c.Telefone)
	}
	if acao.Pedido != nil {
		p := acao.Pedido
		p.AlojamentoID = m.AlojamentoID
		p.AlocacaoID = &m.AlocacaoID
		p.FuncionarioNome = &m.Nome
		p.TelefoneOrigem = &c.Telefone
		por := m.Nome + " (WhatsApp)"
		p.RegistradoPor = &por
		p.Status = dominio.PedidoAberto
		p.CriadoEm = time.Now().UTC()
		p.AtualizadoEm = p.CriadoEm
		err = h.Repo.CriarPedido(r.Context(), p)
		if err == nil {
			numero := p.ID
			if len(numero) > 8 {
				numero = numero[:8]
			}
			resposta = "Pronto! Registrei o seu pedido #" + numero + "."
		}
	}
	if err != nil {
		jsonResposta(w, 500, map[string]string{"erro": err.Error()})
		return
	}
	jsonResposta(w, 200, map[string]any{"resposta": func() any {
		if resposta == "" {
			return nil
		}
		return resposta
	}()})
}
func (h *Handlers) whatsappGrupo(w http.ResponseWriter, r *http.Request, c mensagemWhatsapp) {
	a, err := h.Whatsapp.BuscarAlojamentoPorGrupo(r.Context(), *c.GrupoID)
	if err != nil {
		jsonResposta(w, 500, map[string]string{"erro": err.Error()})
		return
	}
	p := dominio.PedidoDeGrupo(c.Texto)
	if a == nil || p == nil {
		jsonResposta(w, 200, map[string]any{"resposta": nil})
		return
	}
	m, _ := h.Whatsapp.BuscarMoradorPorTelefone(r.Context(), c.Telefone)
	p.AlojamentoID = a.ID
	p.GrupoOrigemID = c.GrupoID
	p.TelefoneOrigem = &c.Telefone
	p.NomeOrigem = c.NomeRemetente
	p.Status = dominio.PedidoAberto
	p.CriadoEm = time.Now().UTC()
	p.AtualizadoEm = p.CriadoEm
	if m != nil {
		p.AlocacaoID = &m.AlocacaoID
		p.FuncionarioNome = &m.Nome
	} else {
		p.FuncionarioNome = c.NomeRemetente
	}
	if err = h.Repo.CriarPedido(r.Context(), p); err != nil {
		jsonResposta(w, 500, map[string]string{"erro": err.Error()})
		return
	}
	numero := p.ID
	if len(numero) > 8 {
		numero = numero[:8]
	}
	jsonResposta(w, 200, map[string]string{"resposta": "Pedido #" + numero + " registrado."})
}

var _ *integracao.Servico
