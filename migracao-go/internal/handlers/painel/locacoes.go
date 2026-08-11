package painel

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/painel"
	dominio "siqueiracampos/servidor/internal/domain/painel"
	tpl "siqueiracampos/servidor/templates/painel"
)

func agora() time.Time { return time.Now().In(dominio.Fuso) }

func statusCor(s dominio.Status) string {
	switch s {
	case dominio.StatusVencida:
		return "#fee2e2"
	case dominio.StatusAtencao:
		return "#fef3c7"
	case dominio.StatusAtiva:
		return "#dcfce7"
	default:
		return "#f1f5f9"
	}
}

func opcoesObras(obras []dominio.Obra) []tpl.Opcao {
	op := make([]tpl.Opcao, len(obras))
	for i, o := range obras {
		op[i] = tpl.Opcao{Valor: o.ID, Rotulo: o.Cliente + " · " + o.Codigo}
	}
	return op
}

func opcoesFornecedores(fs []dominio.Fornecedor) []tpl.Opcao {
	op := make([]tpl.Opcao, len(fs))
	for i, f := range fs {
		op[i] = tpl.Opcao{Valor: f.ID, Rotulo: f.Nome}
	}
	return op
}

func linhaLocacaoView(l dominio.Locacao, hoje time.Time) tpl.LinhaLocacao {
	status := dominio.CalcularStatus(l.DataFim, l.DevolvidaEm, hoje)
	trCodigo := ""
	if l.TrCodigo != nil {
		trCodigo = *l.TrCodigo
	}
	fornecedor := "sem fornecedor"
	if l.FornecedorNome != nil {
		fornecedor = *l.FornecedorNome
	}
	valor := dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim)
	return tpl.LinhaLocacao{
		ID: l.ID, Descricao: l.Descricao, TrCodigo: trCodigo,
		ObraTexto: l.ObraCliente + " · " + l.ObraCodigo, FornecedorTexto: fornecedor,
		DataInicio: dominio.DataBR(l.DataInicio), DataFim: dominio.DataBR(l.DataFim),
		StatusRotulo: dominio.RotuloStatus[status], StatusCor: statusCor(status),
		ValorTotal: dominio.BRL(&valor), Estado: string(l.Estado),
	}
}

func (h *Handlers) ListarLocacoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	q := r.URL.Query()
	filtros := dominio.FiltrosLocacao{
		Busca: q.Get("busca"), ObraID: q.Get("obraId"), FornecedorID: q.Get("fornecedorId"),
		Status: q.Get("status"), Estado: q.Get("estado"), AConfirmar: q.Get("aConfirmar") == "1",
	}

	hoje := agora()
	locs, err := h.RepoLocacoes.Listar(r.Context(), filtros, hoje)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaLocacao, len(locs))
	for i, l := range locs {
		linhas[i] = linhaLocacaoView(l, hoje)
	}

	obrasAtivas, err := h.RepoObras.ListarAtivas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	fornecedoresAtivos, err := h.RepoForn.ListarAtivos(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	contagem := strconv.Itoa(len(linhas)) + " itens"

	tpl.Locacoes(linhas, tpl.FiltrosView{
		Busca: filtros.Busca, ObraID: filtros.ObraID, FornecedorID: filtros.FornecedorID,
		Status: filtros.Status, Estado: filtros.Estado, AConfirmar: filtros.AConfirmar,
	}, opcoesObras(obrasAtivas), opcoesFornecedores(fornecedoresAtivos), contagem).Render(r.Context(), w)
}

func (h *Handlers) LocacaoNovaForm(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	h.renderLocacaoNova(w, r, tpl.EntradaLocacaoForm{})
}

func (h *Handlers) renderLocacaoNova(w http.ResponseWriter, r *http.Request, form tpl.EntradaLocacaoForm) {
	obrasAtivas, err := h.RepoObras.ListarAtivas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	fornecedoresAtivos, err := h.RepoForn.ListarAtivos(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	periodos := make([]tpl.Opcao, len(dominio.Periodos))
	for i, p := range dominio.Periodos {
		periodos[i] = tpl.Opcao{Valor: strconv.Itoa(p.Dias), Rotulo: p.Rotulo}
	}
	hoje := agora().Format("2006-01-02")

	tpl.LocacaoNova(form, opcoesObras(obrasAtivas), opcoesFornecedores(fornecedoresAtivos), periodos, hoje).Render(r.Context(), w)
}

func parseDataForm(v string) *time.Time {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil
	}
	t = t.UTC()
	return &t
}

func parseValorForm(v string) *float64 {
	v = strings.TrimSpace(strings.Replace(v, ",", ".", 1))
	if v == "" {
		return nil
	}
	n, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return nil
	}
	return &n
}

func (h *Handlers) LocacaoCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	quantidade := 1
	if q, err := strconv.Atoi(r.PostFormValue("quantidade")); err == nil && q > 0 {
		quantidade = q
	}

	entrada := aplicacao.EntradaLocacao{
		ObraID: r.PostFormValue("obraId"), Descricao: r.PostFormValue("descricao"),
		TrCodigo: r.PostFormValue("trCodigo"), FornecedorID: r.PostFormValue("fornecedorId"),
		Quantidade: quantidade, DataInicio: parseDataForm(r.PostFormValue("dataInicio")),
		DataFim: parseDataForm(r.PostFormValue("dataFim")), ValorItem: parseValorForm(r.PostFormValue("valorItem")),
		Observacoes: r.PostFormValue("observacoes"),
	}

	if _, err := h.Locacoes.Criar(r.Context(), entrada); err != nil {
		form := tpl.EntradaLocacaoForm{
			Erro: err.Error(), ObraID: entrada.ObraID, Descricao: entrada.Descricao,
			TrCodigo: entrada.TrCodigo, FornecedorID: entrada.FornecedorID,
			Observacoes: entrada.Observacoes, DataInicio: r.PostFormValue("dataInicio"), DataFim: r.PostFormValue("dataFim"),
			ValorItem: r.PostFormValue("valorItem"),
		}
		h.renderLocacaoNova(w, r, form)
		return
	}
	http.Redirect(w, r, "/painel/locacoes", http.StatusSeeOther)
}

func historicoTexto(movs []dominio.Movimentacao) []string {
	textos := make([]string, len(movs))
	for i, m := range movs {
		textos[i] = m.DescricaoHumana
	}
	return textos
}

func (h *Handlers) renderDetalhe(w http.ResponseWriter, r *http.Request, id string, override tpl.DetalheLocacao) {
	l, err := h.RepoLocacoes.BuscarPorID(r.Context(), id)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if l == nil {
		http.NotFound(w, r)
		return
	}
	obrasAtivas, err := h.RepoObras.ListarAtivas(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	hoje := agora()
	status := dominio.CalcularStatus(l.DataFim, l.DevolvidaEm, hoje)
	valor := dominio.ValorTotal(l.ValorItem, l.DataInicio, l.DataFim)
	trCodigo, fornecedor, observacoes := "", "sem fornecedor", ""
	if l.TrCodigo != nil {
		trCodigo = *l.TrCodigo
	}
	if l.FornecedorNome != nil {
		fornecedor = *l.FornecedorNome
	}
	if l.Observacoes != nil {
		observacoes = *l.Observacoes
	}

	proposta := hoje.Format("2006-01-02")
	inicioISO := ""
	if l.DataInicio != nil {
		inicioISO = l.DataInicio.UTC().Format("2006-01-02")
	}

	d := tpl.DetalheLocacao{
		ID: l.ID, Descricao: l.Descricao, TrCodigo: trCodigo,
		ObraTexto: l.ObraCliente + " · " + l.ObraCodigo, ObraID: l.ObraID, FornecedorTexto: fornecedor,
		DataInicio: dominio.DataBR(l.DataInicio), DataFim: dominio.DataBR(l.DataFim), ValorTotal: dominio.BRL(&valor),
		DataInicioISO: inicioISO,
		StatusRotulo:  dominio.RotuloStatus[status], StatusCor: statusCor(status),
		Quantidade: strconv.Itoa(l.Quantidade), Estado: string(l.Estado), Observacoes: observacoes,
		Devolvida: l.DevolvidaEm != nil, Historico: historicoTexto(l.Movimentacoes),
		DataDevolucaoProposta: proposta,
	}
	d.Erro, d.Mensagem = override.Erro, override.Mensagem
	d.AbrirRenovar, d.AbrirTransferir, d.AbrirDevolver = override.AbrirRenovar, override.AbrirTransferir, override.AbrirDevolver

	tpl.LocacaoDetalhe(d, opcoesObras(obrasAtivas)).Render(r.Context(), w)
}

func (h *Handlers) LocacaoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	h.renderDetalhe(w, r, r.PathValue("id"), tpl.DetalheLocacao{})
}

func (h *Handlers) LocacaoRenovar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	var dias *int
	if v := r.PostFormValue("diasExtras"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			dias = &n
		}
	}
	if _, err := h.Locacoes.Renovar(r.Context(), id, dias); err != nil {
		h.renderDetalhe(w, r, id, tpl.DetalheLocacao{Erro: err.Error(), AbrirRenovar: true})
		return
	}
	http.Redirect(w, r, "/painel/locacoes/"+id, http.StatusSeeOther)
}

func (h *Handlers) LocacaoTransferir(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	inicio := parseDataForm(r.PostFormValue("dataInicio"))
	fim := parseDataForm(r.PostFormValue("dataFim"))
	if inicio == nil || fim == nil {
		h.renderDetalhe(w, r, id, tpl.DetalheLocacao{Erro: "Datas inválidas.", AbrirTransferir: true})
		return
	}
	err := h.Locacoes.Transferir(r.Context(), id, r.PostFormValue("obraDestinoId"), *inicio, *fim, r.PostFormValue("motivo"))
	if err != nil {
		h.renderDetalhe(w, r, id, tpl.DetalheLocacao{Erro: err.Error(), AbrirTransferir: true})
		return
	}
	http.Redirect(w, r, "/painel/locacoes/"+id, http.StatusSeeOther)
}

func (h *Handlers) LocacaoDevolver(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	data := parseDataForm(r.PostFormValue("dataDevolucao"))
	if data == nil {
		h.renderDetalhe(w, r, id, tpl.DetalheLocacao{Erro: "Data de devolução inválida.", AbrirDevolver: true})
		return
	}
	if err := h.Locacoes.Devolver(r.Context(), id, *data, r.PostFormValue("motivo")); err != nil {
		h.renderDetalhe(w, r, id, tpl.DetalheLocacao{Erro: err.Error(), AbrirDevolver: true})
		return
	}
	http.Redirect(w, r, "/painel/locacoes/"+id, http.StatusSeeOther)
}
