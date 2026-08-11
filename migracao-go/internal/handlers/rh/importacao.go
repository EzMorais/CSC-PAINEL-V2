package rh

import (
	"net/http"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/infrastructure/upload"
	tpl "siqueiracampos/servidor/templates/rh"
)

// ImportarFuncionariosPagina — formulário de upload. COMPORTAMENTO.md §5.
func (h *Handlers) ImportarFuncionariosPagina(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	tpl.ImportarFuncionarios("", nil, nil).Render(r.Context(), w)
}

func previaParaView(p *aplicacao.Previa) *tpl.PreviaImportacaoView {
	itens := make([]tpl.ItemPreviaView, len(p.Itens))
	for i, it := range p.Itens {
		itens[i] = tpl.ItemPreviaView{
			Nome: it.Nome, CPF: it.CPF, Cargo: it.Cargo, Obra: it.Obra, Admissao: it.AdmitidoEm,
			Situacao: it.Situacao, CriaCargo: it.CriaCargo, CriaObra: it.CriaObra,
		}
	}
	ignoradas := make([]string, len(p.Ignoradas))
	for i, g := range p.Ignoradas {
		ignoradas[i] = g.Motivo + " — " + g.Conteudo
	}
	return &tpl.PreviaImportacaoView{
		Token: p.Token, Itens: itens, Novos: p.Novos, JaExistem: p.JaExistem,
		CargosNovos: p.CargosNovos, ObrasNovas: p.ObrasNovas, SemAdmissao: p.SemAdmissao,
		Ignoradas: ignoradas, ColunasIgnoradas: p.ColunasIgnoradas,
	}
}

// ImportarFuncionariosPrevia lê a planilha do upload e mostra o que vai acontecer — nunca
// grava. COMPORTAMENTO.md §5.
func (h *Handlers) ImportarFuncionariosPrevia(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		tpl.ImportarFuncionarios("A planilha passa de 8 MB. Remova imagens e abas que não são de cadastro.", nil, nil).Render(r.Context(), w)
		return
	}
	arquivo, cabecalho, err := r.FormFile("arquivo")
	if err != nil {
		tpl.ImportarFuncionarios("Escolha a planilha antes de continuar.", nil, nil).Render(r.Context(), w)
		return
	}
	defer arquivo.Close()

	if err := upload.ValidarExtensao(cabecalho.Filename, ".xlsx", ".xlsm"); err != nil {
		tpl.ImportarFuncionarios("Envie um arquivo .xlsx ou .xlsm.", nil, nil).Render(r.Context(), w)
		return
	}
	inicio, conteudo, err := upload.LerAssinatura(arquivo)
	if err != nil {
		tpl.ImportarFuncionarios("Falha ao ler o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	if err := upload.ValidarAssinaturaXLSX(inicio); err != nil {
		tpl.ImportarFuncionarios("O arquivo não parece ser um Excel (.xlsx/.xlsm) válido.", nil, nil).Render(r.Context(), w)
		return
	}

	previa, err := h.Importacao.GerarPrevia(r.Context(), conteudo)
	if err != nil {
		tpl.ImportarFuncionarios(err.Error(), nil, nil).Render(r.Context(), w)
		return
	}
	tpl.ImportarFuncionarios("", previaParaView(previa), nil).Render(r.Context(), w)
}

// ImportarFuncionariosConfirmar grava o que a prévia mostrou — a planilha NÃO é reenviada:
// as linhas já interpretadas ficam em cache de processo, referenciadas pelo token da prévia
// (ver GerenciadorImportacao, adaptação consciente registrada lá). COMPORTAMENTO.md §5.
func (h *Handlers) ImportarFuncionariosConfirmar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	token := r.PostFormValue("token")

	resumo, err := h.Importacao.Confirmar(r.Context(), token, sess.Nome)
	if err != nil {
		tpl.ImportarFuncionarios(err.Error(), nil, nil).Render(r.Context(), w)
		return
	}
	tpl.ImportarFuncionarios("", nil, &tpl.ResultadoImportacaoView{
		Criados: resumo.Criados, Pulados: resumo.Pulados, CargosCriados: resumo.CargosCriados, ObrasCriadas: resumo.ObrasCriadas,
	}).Render(r.Context(), w)
}
