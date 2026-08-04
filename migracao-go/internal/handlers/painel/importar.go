package painel

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/painel"
	tpl "siqueiracampos/servidor/templates/painel"
)

func (h *Handlers) Importar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	tpl.Importar("", nil, nil).Render(r.Context(), w)
}

var reNomeArquivoValido = regexp.MustCompile(`(?i)\.(xlsx|xlsm)$`)

func (h *Handlers) ImportarUpload(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		tpl.Importar("Falha ao receber o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	arquivo, cabecalho, err := r.FormFile("planilha")
	if err != nil {
		tpl.Importar("Nenhum arquivo enviado.", nil, nil).Render(r.Context(), w)
		return
	}
	defer arquivo.Close()

	if !reNomeArquivoValido.MatchString(cabecalho.Filename) {
		tpl.Importar("Envie um arquivo .xlsx ou .xlsm.", nil, nil).Render(r.Context(), w)
		return
	}

	if err := os.MkdirAll(h.PastaUploads, 0o755); err != nil {
		tpl.Importar("Falha ao preparar a pasta de uploads.", nil, nil).Render(r.Context(), w)
		return
	}
	caminho := filepath.Join(h.PastaUploads, "upload-"+strconv.FormatInt(time.Now().UnixMilli(), 10)+".xlsx")
	destino, err := os.Create(caminho)
	if err != nil {
		tpl.Importar("Falha ao gravar o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	if _, err := io.Copy(destino, arquivo); err != nil {
		destino.Close()
		tpl.Importar("Falha ao gravar o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	destino.Close()

	previa, err := h.Importador.GerarPrevia(r.Context(), caminho)
	if err != nil {
		tpl.Importar(err.Error(), nil, nil).Render(r.Context(), w)
		return
	}

	view := &tpl.PreviaView{
		Caminho: caminho,
		Total:   strconv.Itoa(previa.Total), Ativos: strconv.Itoa(previa.Ativos),
		Devolvidos: strconv.Itoa(previa.Devolvidos), Perdidos: strconv.Itoa(previa.Perdidos),
		AConfirmar: strconv.Itoa(previa.AConfirmar), Duplicatas: strconv.Itoa(previa.PossiveisDuplicatas),
		FornecedoresNovos: previa.FornecedoresNovos, Ignoradas: ignoradasTexto(previa.Ignoradas),
	}
	tpl.Importar("", view, nil).Render(r.Context(), w)
}

func ignoradasTexto(itens []dominio.LinhaIgnorada) []string {
	textos := make([]string, len(itens))
	for i, it := range itens {
		textos[i] = it.Aba + ": " + it.Motivo
	}
	return textos
}

func (h *Handlers) ImportarConfirmar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}
	caminho := r.PostFormValue("caminho")

	resultado, err := h.Importador.ConfirmarImportacao(r.Context(), caminho)
	if err != nil {
		tpl.Importar(err.Error(), nil, nil).Render(r.Context(), w)
		return
	}

	texto := strconv.Itoa(resultado.Criadas) + " locações criadas, " + strconv.Itoa(resultado.Puladas) + " já existiam"
	tpl.Importar("", nil, &tpl.ResultadoImportacaoView{Texto: texto}).Render(r.Context(), w)
}
