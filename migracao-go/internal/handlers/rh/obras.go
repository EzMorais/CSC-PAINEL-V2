package rh

import (
	"net/http"
	"sort"

	tpl "siqueiracampos/servidor/templates/rh"
)

// ListarObras — tela só leitura (COMPORTAMENTO.md §2: "RH não tem tela de criar/editar Obra").
// Obra é o cadastro compartilhado do Painel de Locação; o código é a chave que liga os dois.
func (h *Handlers) ListarObras(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()

	if h.ListarObrasFn == nil {
		tpl.Obras(nil).Render(ctx, w)
		return
	}
	obras, err := h.ListarObrasFn(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	sort.Slice(obras, func(i, j int) bool {
		if obras[i].Ativa != obras[j].Ativa {
			return obras[i].Ativa // ativas primeiro
		}
		return obras[i].Codigo < obras[j].Codigo
	})

	efetivo, err := h.RepoFuncionarios.ContarPorObra(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	linhas := make([]tpl.LinhaObra, len(obras))
	for i, o := range obras {
		responsavel := ""
		if o.Responsavel != nil {
			responsavel = *o.Responsavel
		}
		linhas[i] = tpl.LinhaObra{
			ID: o.ID, Codigo: o.Codigo, Descricao: o.Descricao, Cliente: o.Cliente,
			Responsavel: responsavel, Ativa: o.Ativa, Efetivo: efetivo[o.ID],
		}
	}
	tpl.Obras(linhas).Render(ctx, w)
}
