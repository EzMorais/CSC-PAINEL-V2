package painel

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	dominio "siqueiracampos/servidor/internal/domain/painel"
	"siqueiracampos/servidor/internal/infrastructure/upload"
	tpl "siqueiracampos/servidor/templates/painel"
)

func (h *Handlers) Importar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.sessao(w, r); !ok {
		return
	}
	tpl.Importar("", nil, nil).Render(r.Context(), w)
}

const tamanhoMaximoUpload = 32 << 20 // 32 MB — mesmo limite de sempre, só centralizado aqui

func (h *Handlers) ImportarUpload(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	if err := r.ParseMultipartForm(tamanhoMaximoUpload); err != nil {
		tpl.Importar("Falha ao receber o arquivo — confira se não passa de 32 MB.", nil, nil).Render(r.Context(), w)
		return
	}
	arquivo, cabecalho, err := r.FormFile("planilha")
	if err != nil {
		tpl.Importar("Nenhum arquivo enviado.", nil, nil).Render(r.Context(), w)
		return
	}
	defer arquivo.Close()

	if err := upload.ValidarExtensao(cabecalho.Filename, ".xlsx", ".xlsm"); err != nil {
		tpl.Importar("Envie um arquivo .xlsx ou .xlsm.", nil, nil).Render(r.Context(), w)
		return
	}

	// A extensão só confere o NOME que o cliente declarou; a assinatura confere o CONTEÚDO —
	// um arquivo renomeado pra .xlsx sem ser um ZIP/Office válido é recusado aqui, antes de
	// gravar qualquer coisa em disco.
	inicio, conteudo, err := upload.LerAssinatura(arquivo)
	if err != nil {
		tpl.Importar("Falha ao ler o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	if err := upload.ValidarAssinaturaXLSX(inicio); err != nil {
		tpl.Importar("O arquivo não parece ser um Excel (.xlsx/.xlsm) válido.", nil, nil).Render(r.Context(), w)
		return
	}

	if err := os.MkdirAll(h.PastaUploads, 0o755); err != nil {
		tpl.Importar("Falha ao preparar a pasta de uploads.", nil, nil).Render(r.Context(), w)
		return
	}
	caminho := filepath.Join(h.PastaUploads, upload.NomeInterno("upload", ".xlsx"))
	destino, err := os.Create(caminho)
	if err != nil {
		tpl.Importar("Falha ao gravar o arquivo.", nil, nil).Render(r.Context(), w)
		return
	}
	if _, err := io.Copy(destino, conteudo); err != nil {
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

	// `caminho` vem de um campo oculto do formulário — dado do cliente. Sem esta checagem, um
	// valor adulterado (ex.: "../../../algum/arquivo") seria aberto e lido como se fosse a
	// planilha da prévia. Confere que resolve pra dentro da pasta de uploads antes de usar.
	if !upload.CaminhoDentroDaPasta(caminho, h.PastaUploads) {
		tpl.Importar("Arquivo da prévia não encontrado — envie a planilha de novo.", nil, nil).Render(r.Context(), w)
		return
	}

	resultado, err := h.Importador.ConfirmarImportacao(r.Context(), caminho)
	if err != nil {
		tpl.Importar(err.Error(), nil, nil).Render(r.Context(), w)
		return
	}

	texto := strconv.Itoa(resultado.Criadas) + " locações criadas, " + strconv.Itoa(resultado.Puladas) + " já existiam"
	tpl.Importar("", nil, &tpl.ResultadoImportacaoView{Texto: texto}).Render(r.Context(), w)
}
