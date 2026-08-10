package rh

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

func (h *Handlers) ListarExames(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()

	exames, err := h.Exames.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	alertas, err := h.Exames.AlertasVencimento(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	linhas := make([]tpl.LinhaExame, len(exames))
	for i, e := range exames {
		linhas[i] = tpl.LinhaExame{
			Funcionario: e.FuncionarioNome, Tipo: e.Tipo, Resultado: dominio.RotuloResultado[e.Resultado],
			Data: comum.DataBR(&e.RealizadoEm),
		}
	}
	linhasAlerta := make([]tpl.LinhaExame, len(alertas))
	for i, e := range alertas {
		linhasAlerta[i] = tpl.LinhaExame{
			Funcionario: e.FuncionarioNome, Tipo: e.Tipo, Resultado: dominio.RotuloResultado[e.Resultado],
			Data: comum.DataBR(e.ValidadeEm),
		}
	}

	tpl.Exames(linhas, linhasAlerta, h.opcoesTodosFuncionarios(r)).Render(ctx, w)
}

func (h *Handlers) ExameCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := aplicacao.EntradaExame{
		FuncionarioID: r.PostFormValue("funcionarioId"), Tipo: r.PostFormValue("tipo"),
		RealizadoEm: r.PostFormValue("realizadoEm"), ValidadeEm: r.PostFormValue("validadeEm"),
		Resultado: r.PostFormValue("resultado"), Restricoes: r.PostFormValue("restricoes"),
	}
	if err := h.Exames.Criar(r.Context(), entrada, sess.Nome); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/rh/exames", http.StatusSeeOther)
}
