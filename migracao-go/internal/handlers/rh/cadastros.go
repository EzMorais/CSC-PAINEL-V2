package rh

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

func (h *Handlers) renderConfiguracoes(w http.ResponseWriter, r *http.Request, erroCargo, erroSetor string) {
	ctx := r.Context()
	cargos, err := h.RepoCargos.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	ramos, err := h.RepoDepartamentos.ListarRamos(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	// Listar() devolve ramos primeiro (ver RHDepartamentoRepositorio.listar, ORDER BY
	// pai_id IS NOT NULL): filtramos os que têm PaiID pra achar só os setores.
	todos, err := h.RepoDepartamentos.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	nomeRamo := map[string]string{}
	for _, d := range todos {
		if d.PaiID == nil {
			nomeRamo[d.ID] = d.Nome
		}
	}

	linhasCargo := make([]tpl.LinhaCargo, len(cargos))
	for i, c := range cargos {
		cbo := ""
		if c.CBO != nil {
			cbo = *c.CBO
		}
		linhasCargo[i] = tpl.LinhaCargo{ID: c.ID, Nome: c.Nome, CBO: cbo, Risco: c.Risco}
	}
	linhasRamo := make([]tpl.LinhaRamo, len(ramos))
	for i, r := range ramos {
		linhasRamo[i] = tpl.LinhaRamo{ID: r.ID, Nome: r.Nome}
	}
	var linhasSetor []tpl.LinhaSetor
	for _, d := range todos {
		if d.PaiID == nil {
			continue
		}
		linhasSetor = append(linhasSetor, tpl.LinhaSetor{ID: d.ID, Nome: d.Nome, Ramo: nomeRamo[*d.PaiID]})
	}

	tpl.Configuracoes(linhasCargo, linhasRamo, linhasSetor, erroCargo, erroSetor).Render(ctx, w)
}

func (h *Handlers) Configuracoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	h.renderConfiguracoes(w, r, "", "")
}

func (h *Handlers) CargoCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaCargo{
		Nome: r.PostFormValue("nome"), CBO: r.PostFormValue("cbo"), Risco: r.PostFormValue("risco"),
	}
	if err := h.Cargos.Salvar(r.Context(), "", entrada); err != nil {
		h.renderConfiguracoes(w, r, err.Error(), "")
		return
	}
	http.Redirect(w, r, "/rh/configuracoes", http.StatusSeeOther)
}

func (h *Handlers) DepartamentoRamoCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	if err := h.Departamentos.CriarRamo(r.Context(), r.PostFormValue("nome")); err != nil {
		h.renderConfiguracoes(w, r, "", err.Error())
		return
	}
	http.Redirect(w, r, "/rh/configuracoes", http.StatusSeeOther)
}

func (h *Handlers) DepartamentoSetorCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	if err := h.Departamentos.CriarSetor(r.Context(), r.PostFormValue("nome"), r.PostFormValue("ramoId")); err != nil {
		h.renderConfiguracoes(w, r, "", err.Error())
		return
	}
	http.Redirect(w, r, "/rh/configuracoes", http.StatusSeeOther)
}
