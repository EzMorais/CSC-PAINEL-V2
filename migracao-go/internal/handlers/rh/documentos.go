package rh

import (
	"net/http"
	"strconv"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

func vinculoDocumento(dc dominio.DocumentoComContexto) string {
	if dc.FuncionarioNome != nil {
		return *dc.FuncionarioNome
	}
	if dc.ObraCodigo != nil {
		return *dc.ObraCodigo
	}
	return "Empresa"
}

func (h *Handlers) opcoesObras(r *http.Request) []tpl.OpcaoSelect {
	if h.ListarObrasAtivas == nil {
		return nil
	}
	obras, err := h.ListarObrasAtivas(r.Context())
	if err != nil {
		return nil
	}
	opcoes := make([]tpl.OpcaoSelect, len(obras))
	for i, o := range obras {
		opcoes[i] = tpl.OpcaoSelect{ID: o.ID, Rotulo: o.Codigo}
	}
	return opcoes
}

func (h *Handlers) ListarDocumentos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	docs, err := h.Documentos.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaDocumento, len(docs))
	for i, d := range docs {
		linhas[i] = tpl.LinhaDocumento{
			ID: d.ID, Titulo: d.Titulo, Categoria: d.Categoria,
			Vinculo: vinculoDocumento(d), Vencimento: comum.DataBR(d.ValidoAte),
		}
	}
	tpl.Documentos(linhas, h.opcoesObras(r), h.opcoesTodosFuncionarios(r)).Render(ctx, w)
}

func (h *Handlers) DocumentoCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaDocumento{
		Categoria: r.PostFormValue("categoria"), Titulo: r.PostFormValue("titulo"),
		VigenteDesde: r.PostFormValue("vigenteDesde"), ValidoAte: r.PostFormValue("validoAte"),
		Observacao: r.PostFormValue("observacao"),
	}
	if r.PostFormValue("tipo") == "pessoal" {
		entrada.FuncionarioID = r.PostFormValue("funcionarioId")
	} else {
		entrada.ObraID = r.PostFormValue("obraId")
	}
	if _, err := h.Documentos.Criar(r.Context(), entrada, sess.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/documentos", http.StatusSeeOther)
}

func (h *Handlers) DocumentoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	d, versoes, err := h.Documentos.Detalhe(ctx, r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if d == nil {
		http.NotFound(w, r)
		return
	}
	linhasVersao := make([]tpl.LinhaVersaoDocumento, len(versoes))
	for i, v := range versoes {
		linhasVersao[i] = tpl.LinhaVersaoDocumento{
			Versao: strconv.Itoa(v.Versao), VigenteDesde: comum.DataBR(v.VigenteDesde), ValidoAte: comum.DataBR(v.ValidoAte),
		}
	}
	vinculo := "Empresa"
	if d.FuncionarioID != nil {
		if f, _ := h.RepoFuncionarios.BuscarPorID(ctx, *d.FuncionarioID); f != nil {
			vinculo = f.Nome
		}
	} else if d.ObraID != nil {
		vinculo = obraCodigo(h.mapaObras(r), *d.ObraID)
	}

	tpl.DocumentoDetalhe(tpl.DetalheDocumento{
		ID: d.ID, Titulo: d.Titulo, Categoria: d.Categoria, Vinculo: vinculo,
		VersaoAtual: d.Versao, Versoes: linhasVersao,
	}).Render(ctx, w)
}

func (h *Handlers) DocumentoNovaVersao(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	novoID, err := h.Documentos.NovaVersao(r.Context(), id, r.PostFormValue("vigenteDesde"), r.PostFormValue("validoAte"), r.PostFormValue("observacao"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/documentos/"+novoID, http.StatusSeeOther)
}

func obraCodigo(mapa map[string]string, obraID string) string {
	if c, ok := mapa[obraID]; ok {
		return c
	}
	return ""
}
