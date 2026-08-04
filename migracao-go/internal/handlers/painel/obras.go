package painel

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/painel"
	tpl "siqueiracampos/servidor/templates/painel"
)

func (h *Handlers) renderObras(w http.ResponseWriter, r *http.Request, form tpl.FormObra) {
	obras, err := h.RepoObras.Listar(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaObra, len(obras))
	for i, o := range obras {
		qtd, _ := h.RepoObras.ContarLocacoesEmAberto(r.Context(), o.ID)
		responsavel := ""
		if o.Responsavel != nil {
			responsavel = *o.Responsavel
		}
		linhas[i] = tpl.LinhaObra{
			ID: o.ID, Cliente: o.Cliente, Codigo: o.Codigo, Descricao: o.Descricao,
			Responsavel: responsavel, Ativa: o.Ativa, QtdLocacoes: qtd,
		}
	}
	tpl.Obras(linhas, form).Render(r.Context(), w)
}

func (h *Handlers) ListarObras(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	h.renderObras(w, r, tpl.FormObra{})
}

func (h *Handlers) ObraSalvar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	id := r.PostFormValue("id")
	entrada := aplicacao.EntradaObra{
		Cliente: r.PostFormValue("cliente"), Codigo: r.PostFormValue("codigo"),
		Descricao: r.PostFormValue("descricao"), Responsavel: r.PostFormValue("responsavel"),
	}
	if err := h.Obras.Salvar(r.Context(), id, entrada); err != nil {
		h.renderObras(w, r, tpl.FormObra{
			Aberto: true, Erro: err.Error(), ID: id, Cliente: entrada.Cliente,
			Codigo: entrada.Codigo, Descricao: entrada.Descricao, Responsavel: entrada.Responsavel,
		})
		return
	}
	http.Redirect(w, r, "/painel/obras", http.StatusSeeOther)
}

func (h *Handlers) ObraAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	ativa := r.PostFormValue("ativa") == "1"
	if err := h.Obras.Alternar(r.Context(), id, ativa); err != nil {
		obras, _ := h.RepoObras.Listar(r.Context())
		linhas := make([]tpl.LinhaObra, len(obras))
		for i, o := range obras {
			qtd, _ := h.RepoObras.ContarLocacoesEmAberto(r.Context(), o.ID)
			responsavel := ""
			if o.Responsavel != nil {
				responsavel = *o.Responsavel
			}
			l := tpl.LinhaObra{
				ID: o.ID, Cliente: o.Cliente, Codigo: o.Codigo, Descricao: o.Descricao,
				Responsavel: responsavel, Ativa: o.Ativa, QtdLocacoes: qtd,
			}
			if o.ID == id {
				l.Erro = err.Error()
			}
			linhas[i] = l
		}
		tpl.Obras(linhas, tpl.FormObra{}).Render(r.Context(), w)
		return
	}
	http.Redirect(w, r, "/painel/obras", http.StatusSeeOther)
}
