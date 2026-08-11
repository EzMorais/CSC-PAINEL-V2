package estoque

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/estoque"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func (h *Handlers) renderConfiguracoes(w http.ResponseWriter, r *http.Request, override tpl.ConfiguracaoEmailForm) {
	c, err := h.Configuracao.Carregar(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	f := tpl.ConfiguracaoEmailForm{
		Existe: c.Existe, Provedor: c.Provedor, Host: c.Host, Usuario: c.Usuario, Senha: c.Senha,
		Remetente: c.Remetente, DestinatarioPadrao: c.DestinatarioPadrao, CopiaPara: c.CopiaPara,
		EnviarAutomatico: c.EnviarAutomatico, Ativo: c.Ativo, TestadoEm: c.TestadoEm,
	}
	if c.Porta != 0 {
		f.Porta = fnum(float64(c.Porta))
	}
	f.Erro, f.Mensagem = override.Erro, override.Mensagem
	if override.Provedor != "" {
		f.Provedor, f.Host, f.Porta, f.Usuario, f.Senha = override.Provedor, override.Host, override.Porta, override.Usuario, override.Senha
		f.Remetente, f.DestinatarioPadrao, f.CopiaPara, f.EnviarAutomatico = override.Remetente, override.DestinatarioPadrao, override.CopiaPara, override.EnviarAutomatico
	}
	tpl.Configuracoes(f).Render(r.Context(), w)
}

func (h *Handlers) Configuracoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	h.renderConfiguracoes(w, r, tpl.ConfiguracaoEmailForm{})
}

func (h *Handlers) ConfiguracoesSalvar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaConfiguracaoEmail{
		Provedor: r.PostFormValue("provedor"), Host: r.PostFormValue("host"), Porta: r.PostFormValue("porta"),
		Usuario: r.PostFormValue("usuario"), Senha: r.PostFormValue("senha"), Remetente: r.PostFormValue("remetente"),
		DestinatarioPadrao: r.PostFormValue("destinatarioPadrao"), CopiaPara: r.PostFormValue("copiaPara"),
		EnviarAutomatico: r.PostFormValue("enviarAutomatico") == "1",
	}
	if err := h.Configuracao.Salvar(r.Context(), *sess, entrada); err != nil {
		h.renderConfiguracoes(w, r, tpl.ConfiguracaoEmailForm{
			Erro: err.Error(), Provedor: entrada.Provedor, Host: entrada.Host, Porta: entrada.Porta,
			Usuario: entrada.Usuario, Senha: entrada.Senha, Remetente: entrada.Remetente,
			DestinatarioPadrao: entrada.DestinatarioPadrao, CopiaPara: entrada.CopiaPara, EnviarAutomatico: entrada.EnviarAutomatico,
		})
		return
	}
	http.Redirect(w, r, "/almoxarifado/configuracoes", http.StatusSeeOther)
}

func (h *Handlers) ConfiguracoesTestar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.sessao(w, r)
	if !ok {
		return
	}
	resultado, err := h.Configuracao.TestarEnvio(r.Context(), *sess)
	if err != nil {
		h.renderConfiguracoes(w, r, tpl.ConfiguracaoEmailForm{Erro: err.Error()})
		return
	}
	h.renderConfiguracoes(w, r, tpl.ConfiguracaoEmailForm{Mensagem: "E-mail de teste enviado para " + resultado.EnviadoPara + "."})
}

func (h *Handlers) ConfiguracoesDesativar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.sessao(w, r)
	if !ok {
		return
	}
	if err := h.Configuracao.Desativar(r.Context(), *sess); err != nil {
		h.renderConfiguracoes(w, r, tpl.ConfiguracaoEmailForm{Erro: err.Error()})
		return
	}
	http.Redirect(w, r, "/almoxarifado/configuracoes", http.StatusSeeOther)
}
