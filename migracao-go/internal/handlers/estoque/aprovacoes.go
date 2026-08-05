package estoque

import (
	"net/http"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func statusAprovacaoCor(s dominio.StatusAprovacao) string {
	switch s {
	case dominio.AprovacaoAprovada:
		return "#dcfce7"
	case dominio.AprovacaoRejeitada:
		return "#fee2e2"
	default:
		return "#fef3c7"
	}
}

func (h *Handlers) ListarAprovacoes(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = string(dominio.AprovacaoPendente)
	}
	if status == "TODAS" {
		status = ""
	}

	aprovacoes, err := h.Aprovacoes.Listar(r.Context(), status)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	podeDecidir := identidade.PodeAprovar(sess.Cargo)
	linhas := make([]tpl.LinhaAprovacao, len(aprovacoes))
	for i, a := range aprovacoes {
		linhas[i] = tpl.LinhaAprovacao{
			ID: a.ID, TipoRotulo: dominio.RotuloTipoAprovacao[a.Tipo], StatusRotulo: dominio.RotuloStatusAprovacao[a.Status],
			StatusCor: statusAprovacaoCor(a.Status), Resumo: a.Resumo, Motivo: strVal(a.Motivo), SolicitanteNome: a.SolicitanteNome,
			CriadoEm: a.CriadoEm.UTC().Format("02/01/2006"), MotivoDaRegra: dominio.MotivoDaRegra[a.Tipo],
			PodeDecidir: podeDecidir && a.Status == dominio.AprovacaoPendente && a.SolicitanteID != sess.ID,
		}
	}
	tpl.Aprovacoes(linhas, r.URL.Query().Get("status")).Render(r.Context(), w)
}

func (h *Handlers) AprovacaoAprovar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if _, err := h.Aprovacoes.Aprovar(r.Context(), *sess, id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/almoxarifado/aprovacoes", http.StatusSeeOther)
}

func (h *Handlers) AprovacaoRejeitar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	if err := h.Aprovacoes.Rejeitar(r.Context(), *sess, id, r.PostFormValue("motivo")); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/almoxarifado/aprovacoes", http.StatusSeeOther)
}
