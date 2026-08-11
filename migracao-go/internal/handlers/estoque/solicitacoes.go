package estoque

import (
	"net/http"
	"strconv"

	aplicacao "siqueiracampos/servidor/internal/application/estoque"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	tpl "siqueiracampos/servidor/templates/estoque"
)

func statusSolicitacaoCor(s dominio.StatusSolicitacao) string {
	switch s {
	case dominio.StatusEnviada:
		return "#fef3c7"
	case dominio.StatusAtendida:
		return "#dcfce7"
	case dominio.StatusCancelada:
		return "#fee2e2"
	default:
		return "#f1f5f9"
	}
}

func (h *Handlers) ListarSolicitacoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	solicitacoes, err := h.Solicitacoes.Listar(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaSolicitacao, len(solicitacoes))
	for i, s := range solicitacoes {
		emailStatus := "não enviado"
		if s.EmailEnviadoEm != nil {
			emailStatus = "enviado em " + s.EmailEnviadoEm.UTC().Format("02/01/2006")
		} else if s.EmailErro != nil {
			emailStatus = "falhou: " + *s.EmailErro
		}
		linhas[i] = tpl.LinhaSolicitacao{
			ID: s.ID, Numero: s.Numero, StatusRotulo: dominio.RotuloStatusSolicitacao[s.Status],
			StatusCor: statusSolicitacaoCor(s.Status), QtdItens: len(s.Itens),
			CriadoEm: s.CriadoEm.UTC().Format("02/01/2006"), EmailStatus: emailStatus,
		}
	}
	tpl.Solicitacoes(linhas).Render(r.Context(), w)
}

func (h *Handlers) SolicitacaoNovaForm(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	materiais, err := h.Materiais.ListarComSaldo(r.Context(), dominio.FiltrosMaterial{})
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	sugeridos := aplicacao.SugerirItens(materiais)
	itens := make([]tpl.ItemSugeridoView, len(sugeridos))
	for i, s := range sugeridos {
		preco := ""
		if s.PrecoEstimado != nil {
			preco = fnum(*s.PrecoEstimado)
		}
		itens[i] = tpl.ItemSugeridoView{
			MaterialID: s.MaterialID, Codigo: s.Codigo, Nome: s.Nome, Unidade: s.Unidade,
			Saldo: fnum(s.Saldo), EstoqueMinimo: fnum(s.EstoqueMinimo),
			QuantidadeSugerida: fnum(s.QuantidadeSugerida), PrecoEstimado: preco,
		}
	}
	tpl.SolicitacaoNova(itens, "").Render(r.Context(), w)
}

func (h *Handlers) SolicitacaoCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	var itens []aplicacao.ItemEntradaSolicitacao
	for i := 0; ; i++ {
		chave := "materialId_" + strconv.Itoa(i)
		materialID, existe := r.PostForm[chave]
		if !existe {
			break
		}
		if r.PostFormValue("incluir_"+strconv.Itoa(i)) != "1" {
			continue
		}
		itens = append(itens, aplicacao.ItemEntradaSolicitacao{
			MaterialID: materialID[0], Quantidade: r.PostFormValue("quantidade_" + strconv.Itoa(i)),
			SaldoNaEpoca: r.PostFormValue("saldoNaEpoca_" + strconv.Itoa(i)), MinimoNaEpoca: r.PostFormValue("minimoNaEpoca_" + strconv.Itoa(i)),
			PrecoEstimado: r.PostFormValue("precoEstimado_" + strconv.Itoa(i)),
		})
	}

	resultado, err := h.Solicitacoes.Criar(r.Context(), *sess, aplicacao.EntradaSolicitacao{
		Observacao: r.PostFormValue("observacao"), Itens: itens,
	})
	if err != nil {
		h.SolicitacaoNovaFormComErro(w, r, err.Error())
		return
	}
	_ = resultado
	http.Redirect(w, r, "/almoxarifado/solicitacoes", http.StatusSeeOther)
}

func (h *Handlers) SolicitacaoNovaFormComErro(w http.ResponseWriter, r *http.Request, erro string) {
	materiais, _ := h.Materiais.ListarComSaldo(r.Context(), dominio.FiltrosMaterial{})
	sugeridos := aplicacao.SugerirItens(materiais)
	itens := make([]tpl.ItemSugeridoView, len(sugeridos))
	for i, s := range sugeridos {
		preco := ""
		if s.PrecoEstimado != nil {
			preco = fnum(*s.PrecoEstimado)
		}
		itens[i] = tpl.ItemSugeridoView{
			MaterialID: s.MaterialID, Codigo: s.Codigo, Nome: s.Nome, Unidade: s.Unidade,
			Saldo: fnum(s.Saldo), EstoqueMinimo: fnum(s.EstoqueMinimo),
			QuantidadeSugerida: fnum(s.QuantidadeSugerida), PrecoEstimado: preco,
		}
	}
	tpl.SolicitacaoNova(itens, erro).Render(r.Context(), w)
}

func (h *Handlers) renderSolicitacaoDetalhe(w http.ResponseWriter, r *http.Request, id string, override tpl.DetalheSolicitacao) {
	s, err := h.Solicitacoes.Obter(r.Context(), id)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if s == nil {
		http.NotFound(w, r)
		return
	}
	itens := make([]tpl.LinhaItemSolicitacao, len(s.Itens))
	for i, it := range s.Itens {
		preco := "—"
		if it.PrecoEstimado != nil {
			preco = comum.BRL(it.PrecoEstimado)
		}
		itens[i] = tpl.LinhaItemSolicitacao{
			MaterialNome: it.MaterialNome, MaterialCodigo: it.MaterialCodigo, Unidade: it.MaterialUnidade,
			Quantidade: fnum(it.Quantidade), PrecoEstimado: preco,
		}
	}
	emailInfo := "não enviado"
	if s.EmailEnviadoEm != nil {
		emailInfo = "enviado para " + strVal(s.EmailEnviadoPara) + " em " + s.EmailEnviadoEm.UTC().Format("02/01/2006")
	} else if s.EmailErro != nil {
		emailInfo = "falhou: " + *s.EmailErro
	}

	d := tpl.DetalheSolicitacao{
		ID: s.ID, Numero: s.Numero, StatusRotulo: dominio.RotuloStatusSolicitacao[s.Status], StatusCor: statusSolicitacaoCor(s.Status),
		CriadoEm: s.CriadoEm.UTC().Format("02/01/2006"), Observacao: strVal(s.Observacao), RegistradoPor: strVal(s.RegistradoPor),
		Itens: itens, EmailInfo: emailInfo, PodeExcluir: s.Status == dominio.StatusRascunho,
	}
	d.Erro, d.Mensagem = override.Erro, override.Mensagem
	tpl.SolicitacaoDetalhe(d).Render(r.Context(), w)
}

func (h *Handlers) SolicitacaoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	h.renderSolicitacaoDetalhe(w, r, r.PathValue("id"), tpl.DetalheSolicitacao{})
}

func (h *Handlers) SolicitacaoReenviarEmail(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	_, err := h.Solicitacoes.DispararEmail(r.Context(), id, r.PostFormValue("para"))
	if err != nil {
		h.renderSolicitacaoDetalhe(w, r, id, tpl.DetalheSolicitacao{Erro: err.Error()})
		return
	}
	http.Redirect(w, r, "/almoxarifado/solicitacoes/"+id, http.StatusSeeOther)
}

func (h *Handlers) SolicitacaoStatus(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	if err := h.Solicitacoes.MudarStatus(r.Context(), id, r.PostFormValue("status")); err != nil {
		h.renderSolicitacaoDetalhe(w, r, id, tpl.DetalheSolicitacao{Erro: err.Error()})
		return
	}
	http.Redirect(w, r, "/almoxarifado/solicitacoes/"+id, http.StatusSeeOther)
}

func (h *Handlers) SolicitacaoExcluir(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := h.Solicitacoes.Excluir(r.Context(), id); err != nil {
		h.renderSolicitacaoDetalhe(w, r, id, tpl.DetalheSolicitacao{Erro: err.Error()})
		return
	}
	http.Redirect(w, r, "/almoxarifado/solicitacoes", http.StatusSeeOther)
}
