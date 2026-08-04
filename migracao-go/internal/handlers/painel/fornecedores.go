package painel

import (
	"net/http"
	"strings"

	aplicacao "siqueiracampos/servidor/internal/application/painel"
	dominio "siqueiracampos/servidor/internal/domain/painel"
	tpl "siqueiracampos/servidor/templates/painel"
)

func fornecedorParaLinha(f dominio.Fornecedor) tpl.LinhaFornecedor {
	telefone := ""
	if f.Telefone != nil {
		telefone = *f.Telefone
	}
	return tpl.LinhaFornecedor{
		ID: f.ID, Nome: f.Nome, Telefone: telefone,
		AliasesTexto: strings.Join(f.Aliases, ", "), Ativo: f.Ativo,
	}
}

func (h *Handlers) renderFornecedores(w http.ResponseWriter, r *http.Request, form tpl.FormFornecedor) {
	fornecedores, err := h.RepoForn.Listar(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaFornecedor, len(fornecedores))
	for i, f := range fornecedores {
		linhas[i] = fornecedorParaLinha(f)
	}
	tpl.Fornecedores(linhas, form).Render(r.Context(), w)
}

func (h *Handlers) ListarFornecedores(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	h.renderFornecedores(w, r, tpl.FormFornecedor{})
}

func (h *Handlers) FornecedorSalvar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	id := r.PostFormValue("id")
	entrada := aplicacao.EntradaFornecedor{
		Nome: r.PostFormValue("nome"), Telefone: r.PostFormValue("telefone"), Aliases: r.PostFormValue("aliases"),
	}
	if err := h.Fornecedores.Salvar(r.Context(), id, entrada); err != nil {
		h.renderFornecedores(w, r, tpl.FormFornecedor{
			Aberto: true, Erro: err.Error(), ID: id, Nome: entrada.Nome,
			Telefone: entrada.Telefone, Aliases: entrada.Aliases,
		})
		return
	}
	http.Redirect(w, r, "/painel/fornecedores", http.StatusSeeOther)
}

func (h *Handlers) FornecedorAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	ativo := r.PostFormValue("ativo") == "1"
	_ = h.Fornecedores.Alternar(r.Context(), id, ativo)
	http.Redirect(w, r, "/painel/fornecedores", http.StatusSeeOther)
}
