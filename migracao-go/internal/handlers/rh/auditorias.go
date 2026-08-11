package rh

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

func (h *Handlers) ListarAuditorias(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	auditorias, err := h.Auditorias.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaAuditoria, len(auditorias))
	for i, a := range auditorias {
		vinculo := ""
		if a.ObraCodigo != nil {
			vinculo = *a.ObraCodigo
		}
		linhas[i] = tpl.LinhaAuditoria{ID: a.ID, Titulo: a.Titulo, Data: comum.DataBR(&a.RealizadaEm), Vinculo: vinculo}
	}
	tpl.Auditorias(linhas, h.opcoesObras(r)).Render(ctx, w)
}

func (h *Handlers) AuditoriaCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaAuditoria{
		Titulo: r.PostFormValue("titulo"), Norma: r.PostFormValue("norma"), ObraID: r.PostFormValue("obraId"),
		RealizadaEm: r.PostFormValue("realizadaEm"), Responsavel: r.PostFormValue("responsavel"),
	}
	if _, err := h.Auditorias.Criar(r.Context(), entrada, sess.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/auditorias", http.StatusSeeOther)
}

func (h *Handlers) AuditoriaDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	a, itens, err := h.Auditorias.Detalhe(ctx, r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if a == nil {
		http.NotFound(w, r)
		return
	}
	linhas := make([]tpl.LinhaItemAuditoria, len(itens))
	for i, it := range itens {
		evidencia := ""
		if it.Evidencia != nil {
			evidencia = *it.Evidencia
		}
		linhas[i] = tpl.LinhaItemAuditoria{Descricao: it.Descricao, Situacao: dominio.RotuloSituacao[it.Situacao], Evidencia: evidencia}
	}
	responsavel := ""
	if a.Responsavel != nil {
		responsavel = *a.Responsavel
	}
	tpl.AuditoriaDetalhe(tpl.DetalheAuditoria{
		ID: a.ID, Titulo: a.Titulo, Data: comum.DataBR(&a.RealizadaEm), Responsavel: responsavel, Itens: linhas,
	}).Render(ctx, w)
}

func (h *Handlers) AuditoriaItemAdicionar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaItemAuditoria{
		Descricao: r.PostFormValue("descricao"), Situacao: r.PostFormValue("situacao"), Evidencia: r.PostFormValue("evidencia"),
	}
	if err := h.Auditorias.AdicionarItem(r.Context(), id, entrada, sess.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/auditorias/"+id, http.StatusSeeOther)
}

func (h *Handlers) ListarNaoConformidades(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	ncs, err := h.NaoConformidades.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	abertas, err := h.NaoConformidades.ContarAbertas(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	vencidas, err := h.NaoConformidades.ContarVencidas(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaNC, len(ncs))
	for i, nc := range ncs {
		linhas[i] = tpl.LinhaNC{
			Titulo: nc.Titulo, Gravidade: nc.Gravidade, Status: nc.Status, Prazo: comum.DataBR(nc.Prazo),
		}
	}
	tpl.NaoConformidades(linhas, abertas, vencidas).Render(ctx, w)
}
