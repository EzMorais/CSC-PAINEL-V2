package identidade

import (
	"net/http"
	"strings"

	tpl "siqueiracampos/servidor/templates/identidade"
)

// destinoSeguro só aceita caminho relativo — ver COMPORTAMENTO.md §2.2: um endereço
// completo ou "//" (protocolo-relativo) deixaria alguém compartilhar um link que loga a
// pessoa e a joga em outro site parecido com este.
func destinoSeguro(destino string) string {
	if strings.HasPrefix(destino, "/") && !strings.HasPrefix(destino, "//") {
		return destino
	}
	return "/"
}

func (h *Handlers) Entrar(w http.ResponseWriter, r *http.Request) {
	if sess := h.Sessoes.Ler(r); sess != nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	destino := destinoSeguro(r.URL.Query().Get("destino"))
	if destino == "/" {
		destino = ""
	}

	tpl.Entrar(destino, "").Render(r.Context(), w)
}

func (h *Handlers) EntrarSubmeter(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(r.PostFormValue("email"))
	senha := r.PostFormValue("senha")
	destino := r.PostFormValue("destino")

	if email == "" || senha == "" {
		w.WriteHeader(http.StatusOK)
		tpl.Entrar(destino, "Informe o e-mail e a senha.").Render(r.Context(), w)
		return
	}

	sess, err := h.Autenticador.Autenticar(r.Context(), email, senha)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	// Mensagem única de propósito — ver COMPORTAMENTO.md §2.1: dizer qual dos casos
	// falhou (e-mail inexistente, senha errada, conta inativa) revelaria quem tem conta.
	if sess == nil {
		w.WriteHeader(http.StatusOK)
		tpl.Entrar(destino, "E-mail ou senha não conferem.").Render(r.Context(), w)
		return
	}

	if err := h.Sessoes.Criar(w, *sess); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, destinoSeguro(destino), http.StatusFound)
}

func (h *Handlers) Sair(w http.ResponseWriter, r *http.Request) {
	h.Sessoes.Encerrar(w)
	http.Redirect(w, r, "/entrar", http.StatusFound)
}
