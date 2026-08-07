package rh

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

// opcoesTodosFuncionarios alimenta o <select> de funcionário nos formulários de uniforme/
// exame/documento pessoal — sem filtro, qualquer status (mesmo desligado pode ter um
// registro histórico lançado depois, ex. um exame demissional).
func (h *Handlers) opcoesTodosFuncionarios(r *http.Request) []tpl.OpcaoSelect {
	fs, err := h.RepoFuncionarios.Listar(r.Context(), dominio.FiltrosFuncionario{})
	if err != nil {
		return nil
	}
	opcoes := make([]tpl.OpcaoSelect, len(fs))
	for i, f := range fs {
		opcoes[i] = tpl.OpcaoSelect{ID: f.ID, Rotulo: f.Nome}
	}
	return opcoes
}

func (h *Handlers) ListarUniformes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	entregas, err := h.Uniformes.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaUniforme, len(entregas))
	for i, e := range entregas {
		linhas[i] = tpl.LinhaUniforme{
			Funcionario: e.FuncionarioNome, Peca: e.Peca, Tamanho: e.Tamanho, Motivo: e.Motivo,
			Data: comum.DataLocalBR(e.EntregueEm),
		}
	}
	tpl.Uniformes(linhas, h.opcoesTodosFuncionarios(r)).Render(ctx, w)
}

func (h *Handlers) UniformeCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaUniforme{
		FuncionarioID: r.PostFormValue("funcionarioId"), Peca: r.PostFormValue("peca"),
		Tamanho: r.PostFormValue("tamanho"), Motivo: r.PostFormValue("motivo"),
		Quantidade: r.PostFormValue("quantidade"), Observacao: r.PostFormValue("observacao"),
		Assinatura: r.PostFormValue("assinatura"),
	}
	if err := h.Uniformes.Registrar(r.Context(), entrada, sess.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/uniformes", http.StatusSeeOther)
}
