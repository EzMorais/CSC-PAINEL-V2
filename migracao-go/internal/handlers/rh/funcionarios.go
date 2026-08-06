package rh

import (
	"net/http"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	tpl "siqueiracampos/servidor/templates/rh"
)

// dataParaInput formata pro atributo value de <input type="date"> (AAAA-MM-DD) — formato
// HTML, diferente do DD/MM/AAAA que comum.DataBR devolve pra exibição.
func dataParaInput(t time.Time) string { return t.UTC().Format("2006-01-02") }

func (h *Handlers) mapaObras(r *http.Request) map[string]string {
	m := map[string]string{}
	if h.ListarObrasAtivas == nil {
		return m
	}
	obras, err := h.ListarObrasAtivas(r.Context())
	if err != nil {
		return m
	}
	for _, o := range obras {
		m[o.ID] = o.Codigo
	}
	return m
}

func (h *Handlers) mapaCargos(r *http.Request) map[string]string {
	m := map[string]string{}
	cargos, err := h.RepoCargos.Listar(r.Context())
	if err != nil {
		return m
	}
	for _, c := range cargos {
		m[c.ID] = c.Nome
	}
	return m
}

func (h *Handlers) ListarFuncionarios(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	busca := r.URL.Query().Get("busca")

	fs, err := h.RepoFuncionarios.Listar(ctx, dominio.FiltrosFuncionario{
		Busca: busca, Status: r.URL.Query().Get("status"),
		ObraID: r.URL.Query().Get("obraId"), CargoID: r.URL.Query().Get("cargoId"),
	})
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	obras, cargos := h.mapaObras(r), h.mapaCargos(r)
	linhas := make([]tpl.LinhaFuncionario, len(fs))
	for i, f := range fs {
		linhas[i] = tpl.LinhaFuncionario{
			ID: f.ID, Matricula: f.Matricula, Nome: f.Nome, Status: dominio.RotuloStatus[f.Status],
			Obra: nomeOuVazio(f.ObraID, obras), Cargo: nomeOuVazio(f.CargoID, cargos),
		}
	}
	tpl.Funcionarios(linhas, busca, identidade.PodeLancar(sess.Cargo)).Render(ctx, w)
}

func nomeOuVazio(id *string, mapa map[string]string) string {
	if id == nil {
		return ""
	}
	return mapa[*id]
}

func (h *Handlers) opcoesFormulario(r *http.Request) ([]tpl.OpcaoSelect, []tpl.OpcaoSelect) {
	var obrasOpt, cargosOpt []tpl.OpcaoSelect
	if h.ListarObrasAtivas != nil {
		if obras, err := h.ListarObrasAtivas(r.Context()); err == nil {
			for _, o := range obras {
				obrasOpt = append(obrasOpt, tpl.OpcaoSelect{ID: o.ID, Rotulo: o.Codigo})
			}
		}
	}
	if cargos, err := h.RepoCargos.Listar(r.Context()); err == nil {
		for _, c := range cargos {
			cargosOpt = append(cargosOpt, tpl.OpcaoSelect{ID: c.ID, Rotulo: c.Nome})
		}
	}
	return obrasOpt, cargosOpt
}

func (h *Handlers) FuncionarioNovoForm(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	obras, cargos := h.opcoesFormulario(r)
	tpl.FuncionarioForm(tpl.FormFuncionario{Obras: obras, Cargos: cargos}).Render(r.Context(), w)
}

func entradaFuncionarioDoForm(r *http.Request) aplicacao.EntradaFuncionario {
	return aplicacao.EntradaFuncionario{
		Nome: r.PostFormValue("nome"), CPF: r.PostFormValue("cpf"), AdmitidoEm: r.PostFormValue("admitidoEm"),
		Status: r.PostFormValue("status"), TipoContrato: r.PostFormValue("tipoContrato"),
		RG: r.PostFormValue("rg"), DataNascimento: r.PostFormValue("dataNascimento"),
		Sexo: r.PostFormValue("sexo"), EstadoCivil: r.PostFormValue("estadoCivil"), NomeMae: r.PostFormValue("nomeMae"),
		Foto: r.PostFormValue("foto"), Telefone: r.PostFormValue("telefone"), Email: r.PostFormValue("email"),
		CEP: r.PostFormValue("cep"), Logradouro: r.PostFormValue("logradouro"), Numero: r.PostFormValue("numero"),
		Complemento: r.PostFormValue("complemento"), Bairro: r.PostFormValue("bairro"),
		Cidade: r.PostFormValue("cidade"), UF: r.PostFormValue("uf"),
		ObraID: r.PostFormValue("obraId"), CargoID: r.PostFormValue("cargoId"), DepartamentoID: r.PostFormValue("departamentoId"),
		NivelObra: r.PostFormValue("nivelObra"), Salario: r.PostFormValue("salario"),
		Banco: r.PostFormValue("banco"), Agencia: r.PostFormValue("agencia"), Conta: r.PostFormValue("conta"),
		TipoConta: r.PostFormValue("tipoConta"), ChavePix: r.PostFormValue("chavePix"),
		TamanhoCamisa: r.PostFormValue("tamanhoCamisa"), TamanhoCalca: r.PostFormValue("tamanhoCalca"),
		TamanhoCalcado: r.PostFormValue("tamanhoCalcado"), Observacoes: r.PostFormValue("observacoes"),
	}
}

func formularioComErro(entrada aplicacao.EntradaFuncionario, id, erro string, obras, cargos []tpl.OpcaoSelect) tpl.FormFuncionario {
	return tpl.FormFuncionario{
		ID: id, Erro: erro, Nome: entrada.Nome, CPF: entrada.CPF, AdmitidoEm: entrada.AdmitidoEm,
		Status: entrada.Status, TipoContrato: entrada.TipoContrato, Telefone: entrada.Telefone, Email: entrada.Email,
		ObraID: entrada.ObraID, CargoID: entrada.CargoID, DepartamentoID: entrada.DepartamentoID,
		NivelObra: entrada.NivelObra, Salario: entrada.Salario,
		TamanhoCamisa: entrada.TamanhoCamisa, TamanhoCalca: entrada.TamanhoCalca, TamanhoCalcado: entrada.TamanhoCalcado,
		Obras: obras, Cargos: cargos,
	}
}

func (h *Handlers) FuncionarioCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := entradaFuncionarioDoForm(r)

	id, err := h.Funcionarios.Criar(r.Context(), entrada, sess.Nome)
	if err != nil {
		obras, cargos := h.opcoesFormulario(r)
		tpl.FuncionarioForm(formularioComErro(entrada, "", err.Error(), obras, cargos)).Render(r.Context(), w)
		return
	}
	http.Redirect(w, r, "/rh/funcionarios/"+id, http.StatusSeeOther)
}

func (h *Handlers) montarDetalhe(r *http.Request, f *dominio.Funcionario, sess *identidade.Sessao, erroExclusao string) (tpl.DetalheFuncionario, error) {
	ctx := r.Context()
	obras, cargos := h.mapaObras(r), h.mapaCargos(r)

	eventos, err := h.RepoEventos.ListarPorFuncionario(ctx, f.ID)
	if err != nil {
		return tpl.DetalheFuncionario{}, err
	}
	timeline := make([]tpl.LinhaTimeline, len(eventos))
	for i, e := range eventos {
		timeline[i] = tpl.LinhaTimeline{Descricao: e.DescricaoHumana, Quando: comum.DataBR(&e.OcorridoEm)}
	}

	telefone := ""
	if f.Telefone != nil {
		telefone = *f.Telefone
	}
	email := ""
	if f.Email != nil {
		email = *f.Email
	}

	return tpl.DetalheFuncionario{
		ID: f.ID, Matricula: f.Matricula, Nome: f.Nome, CPF: dominio.FormatarCPF(f.CPF),
		Status: dominio.RotuloStatus[f.Status], Obra: nomeOuVazio(f.ObraID, obras), Cargo: nomeOuVazio(f.CargoID, cargos),
		Telefone: telefone, Email: email, PodeExcluir: sess != nil && identidade.PodeAdministrar(sess.Cargo),
		ErroExclusao: erroExclusao, Timeline: timeline,
	}, nil
}

func (h *Handlers) FuncionarioDetalhe(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}
	f, err := h.RepoFuncionarios.BuscarPorID(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if f == nil {
		http.NotFound(w, r)
		return
	}
	detalhe, err := h.montarDetalhe(r, f, sess, "")
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	tpl.FuncionarioDetalhe(detalhe).Render(r.Context(), w)
}

func (h *Handlers) FuncionarioEditarForm(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	f, err := h.RepoFuncionarios.BuscarPorID(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if f == nil {
		http.NotFound(w, r)
		return
	}
	obras, cargos := h.opcoesFormulario(r)
	form := tpl.FormFuncionario{
		ID: f.ID, Nome: f.Nome, CPF: dominio.FormatarCPF(f.CPF), AdmitidoEm: dataParaInput(f.AdmitidoEm),
		Status: f.Status, TipoContrato: f.TipoContrato, Obras: obras, Cargos: cargos,
	}
	if f.Telefone != nil {
		form.Telefone = *f.Telefone
	}
	if f.Email != nil {
		form.Email = *f.Email
	}
	if f.ObraID != nil {
		form.ObraID = *f.ObraID
	}
	if f.CargoID != nil {
		form.CargoID = *f.CargoID
	}
	if f.TamanhoCamisa != nil {
		form.TamanhoCamisa = *f.TamanhoCamisa
	}
	if f.TamanhoCalca != nil {
		form.TamanhoCalca = *f.TamanhoCalca
	}
	if f.TamanhoCalcado != nil {
		form.TamanhoCalcado = *f.TamanhoCalcado
	}
	tpl.FuncionarioForm(form).Render(r.Context(), w)
}

func (h *Handlers) FuncionarioEditar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	entrada := entradaFuncionarioDoForm(r)

	if err := h.Funcionarios.Editar(r.Context(), id, entrada, sess.Nome); err != nil {
		obras, cargos := h.opcoesFormulario(r)
		tpl.FuncionarioForm(formularioComErro(entrada, id, err.Error(), obras, cargos)).Render(r.Context(), w)
		return
	}
	http.Redirect(w, r, "/rh/funcionarios/"+id, http.StatusSeeOther)
}

func (h *Handlers) FuncionarioExcluir(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirAdministracao(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")

	if _, err := h.Funcionarios.Excluir(r.Context(), id); err != nil {
		f, buscaErr := h.RepoFuncionarios.BuscarPorID(r.Context(), id)
		if buscaErr != nil || f == nil {
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		detalhe, err2 := h.montarDetalhe(r, f, sess, err.Error())
		if err2 != nil {
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		tpl.FuncionarioDetalhe(detalhe).Render(r.Context(), w)
		return
	}
	http.Redirect(w, r, "/rh/funcionarios", http.StatusSeeOther)
}
