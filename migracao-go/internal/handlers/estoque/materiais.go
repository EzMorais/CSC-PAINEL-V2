package estoque

import (
	"net/http"
	"strconv"

	aplicacao "siqueiracampos/servidor/internal/application/estoque"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func categoriasOpcoes() []tpl.Opcao {
	op := make([]tpl.Opcao, len(dominio.Categorias))
	for i, c := range dominio.Categorias {
		op[i] = tpl.Opcao{Valor: string(c), Rotulo: dominio.RotuloCategoria[c]}
	}
	return op
}

func situacaoCor(s dominio.SituacaoSaldo) string {
	switch s {
	case dominio.SituacaoZerado:
		return "#fee2e2"
	case dominio.SituacaoAbaixo:
		return "#fef3c7"
	default:
		return "#dcfce7"
	}
}

func tipoCor(t dominio.TipoMovimentacao) string {
	switch t {
	case dominio.MovPerda:
		return "#fee2e2"
	case dominio.MovSaida:
		return "#fef3c7"
	case dominio.MovEntrada, dominio.MovDevolucao:
		return "#dcfce7"
	default:
		return "#f1f5f9"
	}
}

func fnum(v float64) string { return strconv.FormatFloat(v, 'f', -1, 64) }

func linhaMaterialView(m dominio.MaterialComSaldo) tpl.LinhaMaterial {
	valor := "—"
	if m.ValorEmEstoque != nil {
		valor = comum.BRL(m.ValorEmEstoque)
	}
	return tpl.LinhaMaterial{
		ID: m.ID, Codigo: m.Codigo, Nome: m.Nome, Categoria: dominio.RotuloCategoria[m.Categoria], Unidade: m.Unidade,
		Saldo: fnum(m.Saldo), EstoqueMinimo: fnum(m.EstoqueMinimo), ValorEmEstoque: valor,
		SituacaoRotulo: dominio.RotuloSituacaoSaldo[m.Situacao], SituacaoCor: situacaoCor(m.Situacao), Ativo: m.Ativo,
	}
}

func (h *Handlers) ListarMateriais(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	q := r.URL.Query()
	filtros := dominio.FiltrosMaterial{Busca: q.Get("busca"), Categoria: q.Get("categoria"), Situacao: q.Get("situacao")}

	materiais, err := h.Materiais.ListarComSaldo(r.Context(), filtros)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaMaterial, len(materiais))
	for i, m := range materiais {
		linhas[i] = linhaMaterialView(m)
	}

	tpl.Materiais(linhas, tpl.FiltrosMateriaisView{Busca: filtros.Busca, Categoria: filtros.Categoria, Situacao: filtros.Situacao},
		categoriasOpcoes(), tpl.FormMaterial{}).Render(r.Context(), w)
}

func (h *Handlers) MaterialSalvar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	id := r.PostFormValue("id")
	entrada := aplicacao.EntradaMaterial{
		Nome: r.PostFormValue("nome"), Categoria: r.PostFormValue("categoria"), Unidade: r.PostFormValue("unidade"),
		EstoqueMinimo: r.PostFormValue("estoqueMinimo"), Localizacao: r.PostFormValue("localizacao"),
		Observacao: r.PostFormValue("observacao"), CA: r.PostFormValue("ca"), ValidadeCA: r.PostFormValue("validadeCA"),
	}

	var erro error
	if id == "" {
		_, erro = h.Materiais.Criar(r.Context(), entrada)
	} else {
		erro = h.Materiais.Editar(r.Context(), id, entrada)
	}
	if erro != nil {
		materiais, _ := h.Materiais.ListarComSaldo(r.Context(), dominio.FiltrosMaterial{})
		linhas := make([]tpl.LinhaMaterial, len(materiais))
		for i, m := range materiais {
			linhas[i] = linhaMaterialView(m)
		}
		tpl.Materiais(linhas, tpl.FiltrosMateriaisView{}, categoriasOpcoes(), tpl.FormMaterial{
			Aberto: true, Erro: erro.Error(), ID: id, Nome: entrada.Nome, Categoria: entrada.Categoria,
			Unidade: entrada.Unidade, EstoqueMinimo: entrada.EstoqueMinimo, Localizacao: entrada.Localizacao,
			Observacao: entrada.Observacao, CA: entrada.CA, ValidadeCA: entrada.ValidadeCA,
		}).Render(r.Context(), w)
		return
	}
	http.Redirect(w, r, "/almoxarifado/materiais", http.StatusSeeOther)
}

func (h *Handlers) MaterialAlternar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	ativo := r.PostFormValue("ativo") == "1"
	_ = h.Materiais.Alternar(r.Context(), id, ativo)
	http.Redirect(w, r, "/almoxarifado/materiais/"+id, http.StatusSeeOther)
}
