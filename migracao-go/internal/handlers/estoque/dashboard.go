package estoque

import (
	"net/http"
	"strconv"

	"siqueiracampos/servidor/internal/domain/comum"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func (h *Handlers) DashboardPagina(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()

	obrasAtivas, err := h.RepoObras.ListarAtivas(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	ind, err := h.Dashboard.Indicadores(ctx, len(obrasAtivas))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	pendentes, err := h.Aprovacoes.ContarPendentes(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	valor := ind.ValorEmEstoque
	kpis := tpl.KpisDashboard{
		TotalMateriais: strconv.Itoa(ind.TotalMateriais), SemEstoque: strconv.Itoa(ind.SemEstoque),
		AbaixoDoMinimo: strconv.Itoa(ind.AbaixoDoMinimo), ValorEmEstoque: comum.BRL(&valor),
		EntradasDoMes: strconv.Itoa(ind.EntradasDoMes), SaidasDoMes: strconv.Itoa(ind.SaidasDoMes),
		ObrasAtivas: strconv.Itoa(ind.ObrasAtivas), AprovacoesPendentes: strconv.Itoa(pendentes),
	}

	paraRepor, err := h.Dashboard.MateriaisParaRepor(ctx, 10)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhasRepor := make([]tpl.LinhaMaterial, len(paraRepor))
	for i, m := range paraRepor {
		linhasRepor[i] = linhaMaterialView(m)
	}

	recentes, err := h.Dashboard.MovimentacoesRecentes(ctx, 8)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhasRecentes := make([]tpl.LinhaMovimentacao, len(recentes))
	for i, m := range recentes {
		linhasRecentes[i] = linhaHistoricoView(m)
	}

	tpl.Dashboard(kpis, linhasRepor, linhasRecentes).Render(ctx, w)
}
