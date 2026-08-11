package rh

import (
	"net/http"

	"siqueiracampos/servidor/internal/domain/comum"
	tpl "siqueiracampos/servidor/templates/rh"
)

func (h *Handlers) DashboardPagina(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()

	obrasAtivas := 0
	if h.ContarObrasAtivas != nil {
		obrasAtivas, _ = h.ContarObrasAtivas(ctx)
	}

	ind, err := h.Dashboard.Carregar(ctx, obrasAtivas)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	eventos, err := h.Dashboard.EventosRecentes(ctx, 8)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaEvento, len(eventos))
	for i, e := range eventos {
		linhas[i] = tpl.LinhaEvento{Descricao: e.DescricaoHumana, Quando: comum.DataBR(&e.OcorridoEm)}
	}

	tpl.Dashboard(ind.Ativos, ind.Afastados, ind.Ferias, ind.Desligados, ind.CadastrosIncompletos, linhas).Render(ctx, w)
}
