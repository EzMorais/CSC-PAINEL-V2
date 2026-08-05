package estoque

import (
	"net/http"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/estoque"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func tiposMovimentacaoOpcoes() []tpl.Opcao {
	ordem := []dominio.TipoMovimentacao{dominio.MovEntrada, dominio.MovSaida, dominio.MovDevolucao, dominio.MovPerda, dominio.MovAjustePositivo, dominio.MovAjusteNegativo}
	op := make([]tpl.Opcao, len(ordem))
	for i, t := range ordem {
		op[i] = tpl.Opcao{Valor: string(t), Rotulo: dominio.RotuloMovimentacao[t]}
	}
	return op
}

func linhaHistoricoView(m dominio.Movimentacao) tpl.LinhaMovimentacao {
	obraTexto := ""
	if m.ObraCodigo != nil {
		obraTexto = *m.ObraCodigo
	}
	fornecedorTexto := ""
	if m.FornecedorNome != nil {
		fornecedorTexto = *m.FornecedorNome
	}
	return tpl.LinhaMovimentacao{
		ID: m.ID, TipoRotulo: dominio.RotuloMovimentacao[m.Tipo], TipoCor: tipoCor(m.Tipo),
		MaterialTexto: m.MaterialNome, Quantidade: fnum(m.Quantidade) + " " + m.MaterialUnidade,
		ObraTexto: obraTexto, FornecedorTexto: fornecedorTexto,
		OcorridoEm: m.OcorridoEm.UTC().Format("02/01/2006"), RegistradoPor: strVal(m.RegistradoPor),
		FichaPendente: m.FuncionarioID != nil && m.SincronizadoEm == nil,
	}
}

func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (h *Handlers) renderMaterialDetalhe(w http.ResponseWriter, r *http.Request, id string, override tpl.DetalheMaterial) {
	m, err := h.Materiais.ObterComSaldo(r.Context(), id)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if m == nil {
		http.NotFound(w, r)
		return
	}
	movs, err := h.RepoMovimentacoes.Listar(r.Context(), dominio.FiltrosMovimentacao{MaterialID: id}, 200)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	historico := make([]tpl.LinhaMovimentacao, len(movs))
	for i, mv := range movs {
		historico[i] = linhaHistoricoView(mv)
	}

	obrasAtivas, err := h.RepoObras.ListarAtivas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	obrasOp := make([]tpl.Opcao, len(obrasAtivas))
	for i, o := range obrasAtivas {
		obrasOp[i] = tpl.Opcao{Valor: o.ID, Rotulo: o.Cliente + " · " + o.Codigo}
	}
	fornecedoresAtivos, err := h.RepoFornecedores.ListarAtivos(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	fornecedoresOp := make([]tpl.Opcao, len(fornecedoresAtivos))
	for i, f := range fornecedoresAtivos {
		fornecedoresOp[i] = tpl.Opcao{Valor: f.ID, Rotulo: f.Nome}
	}

	d := tpl.DetalheMaterial{
		ID: m.ID, Codigo: m.Codigo, Nome: m.Nome, CategoriaRotulo: dominio.RotuloCategoria[m.Categoria], Unidade: m.Unidade,
		Saldo: fnum(m.Saldo), EstoqueMinimo: fnum(m.EstoqueMinimo),
		SituacaoRotulo: dominio.RotuloSituacaoSaldo[m.Situacao], SituacaoCor: situacaoCor(m.Situacao),
		Localizacao: strVal(m.Localizacao), Observacao: strVal(m.Observacao), CA: strVal(m.CA),
		EhEPI: m.Categoria == dominio.CategoriaEPI, Ativo: m.Ativo, Historico: historico,
	}
	if m.ValidadeCA != nil {
		d.ValidadeCA = m.ValidadeCA.UTC().Format("02/01/2006")
	}
	d.Erro, d.Mensagem = override.Erro, override.Mensagem
	d.AbrirMovimentar, d.AbrirAjustar = override.AbrirMovimentar, override.AbrirAjustar

	hoje := time.Now().UTC().Format("2006-01-02")
	tpl.MaterialDetalhe(d, obrasOp, fornecedoresOp, tiposMovimentacaoOpcoes(), hoje).Render(r.Context(), w)
}

func (h *Handlers) MaterialDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	h.renderMaterialDetalhe(w, r, r.PathValue("id"), tpl.DetalheMaterial{})
}

func (h *Handlers) MaterialMovimentar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaMovimentacao{
		MaterialID: id, Tipo: r.PostFormValue("tipo"), Quantidade: r.PostFormValue("quantidade"),
		ValorUnitario: r.PostFormValue("valorUnitario"), ObraID: r.PostFormValue("obraId"),
		FornecedorID: r.PostFormValue("fornecedorId"), FuncionarioID: r.PostFormValue("funcionarioId"),
		FuncionarioNome: r.PostFormValue("funcionarioNome"), Documento: r.PostFormValue("documento"),
		Observacao: r.PostFormValue("observacao"), OcorridoEm: r.PostFormValue("ocorridoEm"),
	}
	resultado, err := h.Movimentacoes.Registrar(r.Context(), *sess, entrada)
	if err != nil {
		h.renderMaterialDetalhe(w, r, id, tpl.DetalheMaterial{Erro: err.Error(), AbrirMovimentar: true})
		return
	}
	mensagem := ""
	if resultado.PendenteAprovacao {
		mensagem = "Enviado para aprovação — nada foi lançado ainda."
	}
	if mensagem != "" {
		h.renderMaterialDetalhe(w, r, id, tpl.DetalheMaterial{Mensagem: mensagem})
		return
	}
	http.Redirect(w, r, "/almoxarifado/materiais/"+id, http.StatusSeeOther)
}

func (h *Handlers) MaterialAjustar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaAjuste{
		MaterialID: id, QuantidadeContada: r.PostFormValue("quantidadeContada"), Observacao: r.PostFormValue("observacao"),
	}
	resultado, err := h.Movimentacoes.AjustarPorInventario(r.Context(), *sess, entrada)
	if err != nil {
		h.renderMaterialDetalhe(w, r, id, tpl.DetalheMaterial{Erro: err.Error(), AbrirAjustar: true})
		return
	}
	if resultado.PendenteAprovacao {
		h.renderMaterialDetalhe(w, r, id, tpl.DetalheMaterial{Mensagem: "Enviado para aprovação — nada foi lançado ainda."})
		return
	}
	http.Redirect(w, r, "/almoxarifado/materiais/"+id, http.StatusSeeOther)
}

func (h *Handlers) MovimentacaoReenviarFicha(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	mov, err := h.RepoMovimentacoes.BuscarPorID(r.Context(), id)
	if err != nil || mov == nil {
		http.NotFound(w, r)
		return
	}
	_ = h.Movimentacoes.SincronizarFicha(r.Context(), id)
	http.Redirect(w, r, "/almoxarifado/materiais/"+mov.MaterialID, http.StatusSeeOther)
}
