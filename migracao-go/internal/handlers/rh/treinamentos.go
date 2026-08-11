package rh

import (
	"net/http"

	"siqueiracampos/servidor/internal/domain/comum"
	tpl "siqueiracampos/servidor/templates/rh"
)

func (h *Handlers) ListarTreinamentos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	busca := r.URL.Query().Get("busca")

	ts, err := h.Treinamentos.Listar(ctx, busca)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	alertas, err := h.Treinamentos.AlertasVencimento(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	linhas := make([]tpl.LinhaTreinamento, len(ts))
	for i, t := range ts {
		linhas[i] = tpl.LinhaTreinamento{ID: t.ID, Descricao: t.Descricao, Norma: t.Norma, Validade: comum.DataBR(t.ValidadeEm)}
	}
	linhasAlerta := make([]tpl.LinhaTreinamento, len(alertas))
	for i, t := range alertas {
		linhasAlerta[i] = tpl.LinhaTreinamento{ID: t.ID, Descricao: t.Descricao, Norma: t.Norma, Validade: comum.DataBR(t.ValidadeEm)}
	}

	tpl.Treinamentos(linhas, linhasAlerta, busca).Render(ctx, w)
}

func (h *Handlers) TreinamentoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	id := r.PathValue("id")

	t, participantes, err := h.Treinamentos.Detalhe(ctx, id)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if t == nil {
		http.NotFound(w, r)
		return
	}
	elegiveis, err := h.RepoTreinamentos.ListarElegiveisParaTurma(ctx, id)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	linhasParticipante := make([]tpl.LinhaParticipante, len(participantes))
	for i, p := range participantes {
		linhasParticipante[i] = tpl.LinhaParticipante{ID: p.ID, Nome: p.FuncionarioNome}
	}
	opcoesElegiveis := make([]tpl.OpcaoSelect, len(elegiveis))
	for i, o := range elegiveis {
		opcoesElegiveis[i] = tpl.OpcaoSelect{ID: o.ID, Rotulo: o.Nome}
	}

	instrutor := ""
	if t.Instrutor != nil {
		instrutor = *t.Instrutor
	}
	tpl.TreinamentoDetalhe(tpl.DetalheTreinamento{
		ID: t.ID, Descricao: t.Descricao, Norma: t.Norma, Instrutor: instrutor,
		RealizadoEm: comum.DataBR(&t.RealizadoEm), ValidadeEm: comum.DataBR(t.ValidadeEm),
		Participantes: linhasParticipante, Elegiveis: opcoesElegiveis,
	}).Render(ctx, w)
}

func (h *Handlers) TreinamentoParticipanteAdicionar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	if err := h.Treinamentos.AdicionarParticipante(r.Context(), id, r.PostFormValue("funcionarioId")); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/treinamentos/"+id, http.StatusSeeOther)
}
