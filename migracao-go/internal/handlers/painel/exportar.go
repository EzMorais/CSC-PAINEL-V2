package painel

import (
	"net/http"
	"strconv"

	identidade "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/infrastructure/planilha"
	"siqueiracampos/servidor/internal/infrastructure/relatorio"
)

// exigirSessaoDownload espelha sessao(), mas responde 401/403 direto (não redireciona) —
// ver COMPORTAMENTO.md §1 e §7: rota de download, não página; um redirect entregaria um
// HTML de login no lugar do arquivo esperado, mas o ponto central é não vazar o arquivo.
func (h *Handlers) exigirSessaoDownload(w http.ResponseWriter, r *http.Request) bool {
	sess := h.Sessoes.Ler(r)
	if sess == nil {
		http.Error(w, "Não autenticado", http.StatusUnauthorized)
		return false
	}
	if !identidade.TemAcesso(*sess, identidade.ModuloPainel) {
		http.Error(w, "Acesso ao Painel de Locação não liberado.", http.StatusForbidden)
		return false
	}
	return true
}

func (h *Handlers) ExportarXLSX(w http.ResponseWriter, r *http.Request) {
	if !h.exigirSessaoDownload(w, r) {
		return
	}
	obras, err := h.RepoLocacoes.ParaExportarExcel(r.Context())
	if err != nil {
		http.Error(w, "Falha ao gerar a planilha", http.StatusInternalServerError)
		return
	}
	bytes, err := planilha.GerarExcel(obras, agora())
	if err != nil {
		http.Error(w, "Falha ao gerar a planilha", http.StatusInternalServerError)
		return
	}
	nome := "locacoes-sc-" + agora().Format("2006-01-02") + ".xlsx"
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+nome+`"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.Write(bytes)
}

func (h *Handlers) ExportarPDF(w http.ResponseWriter, r *http.Request) {
	if !h.exigirSessaoDownload(w, r) {
		return
	}
	obras, err := h.RepoLocacoes.ParaExportarPDF(r.Context())
	if err != nil {
		http.Error(w, "Falha ao gerar o PDF", http.StatusInternalServerError)
		return
	}
	bytes, err := relatorio.GerarPDF(obras, agora())
	if err != nil {
		http.Error(w, "Falha ao gerar o PDF", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="locacoes-sc.pdf"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.Write(bytes)
}
