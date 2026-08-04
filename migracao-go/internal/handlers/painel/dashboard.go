package painel

import (
	"net/http"
	"strconv"

	aplicacao "siqueiracampos/servidor/internal/application/painel"
	dominio "siqueiracampos/servidor/internal/domain/painel"
	tpl "siqueiracampos/servidor/templates/painel"
)

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	hoje := agora()

	indicadores, err := aplicacao.ObterIndicadores(r.Context(), h.RepoLocacoes, hoje)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	vencimentos, err := h.RepoLocacoes.VencimentosProximos(r.Context(), dominio.LimiteEmDias(dominio.DiasAtencao, hoje), 25)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhasVencimento := make([]tpl.LinhaVencimento, len(vencimentos))
	for i, v := range vencimentos {
		valor := dominio.ValorTotal(v.ValorItem, v.DataInicio, v.DataFim)
		linhasVencimento[i] = tpl.LinhaVencimento{
			Descricao: v.Descricao, ObraTexto: v.ObraCliente + " · " + v.ObraCodigo,
			DataFim: dominio.DataBR(v.DataFim), Valor: dominio.BRL(&valor),
		}
	}

	porObra, err := h.RepoLocacoes.PorObraNaoDevolvidas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	porFornecedor, err := h.RepoLocacoes.PorFornecedorNaoDevolvidas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	kpis := tpl.Kpis{
		ValorEmLocacao: dominio.BRL(&indicadores.ValorEmLocacao),
		Ativos:         strconv.Itoa(indicadores.Ativos),
		VencemEm7Dias:  strconv.Itoa(indicadores.VencemEm7Dias),
		Vencidos:       strconv.Itoa(indicadores.Vencidos),
		Perdidos:       strconv.Itoa(indicadores.Perdidos),
		AConfirmar:     strconv.Itoa(indicadores.AConfirmar),
	}

	tpl.Dashboard(kpis, linhasVencimento, agregadaView(porObra), agregadaView(porFornecedor)).Render(r.Context(), w)
}

func agregadaView(linhas []dominio.LinhaAgregada) []tpl.LinhaAgregadaView {
	r := make([]tpl.LinhaAgregadaView, len(linhas))
	for i, l := range linhas {
		r[i] = tpl.LinhaAgregadaView{Nome: l.Nome, Valor: dominio.BRL(&l.Valor)}
	}
	return r
}
