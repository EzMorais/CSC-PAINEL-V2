package estoque

import (
	"net/http"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func (h *Handlers) ListarMovimentacoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	q := r.URL.Query()
	filtros := dominio.FiltrosMovimentacao{Busca: q.Get("busca"), Tipo: q.Get("tipo")}

	movs, err := h.RepoMovimentacoes.Listar(r.Context(), filtros, 200)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaMovimentacao, len(movs))
	for i, m := range movs {
		linhas[i] = linhaHistoricoView(m)
	}
	tpl.Movimentacoes(linhas, filtros.Tipo, filtros.Busca).Render(r.Context(), w)
}
