package rh

import (
	"net/http"
	"sort"
	"time"

	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
	"siqueiracampos/servidor/internal/infrastructure/planilha"
	"siqueiracampos/servidor/internal/infrastructure/relatorio"
	tpl "siqueiracampos/servidor/templates/rh"
)

// RelatoriosPagina lista os botões de exportação e alguns indicadores — passa pelo layout
// normal (COMPORTAMENTO.md §7 só isenta as rotas de DOWNLOAD, não esta).
func (h *Handlers) RelatoriosPagina(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	tpl.Relatorios().Render(r.Context(), w)
}

// exigirSessaoManual espelha `lerSessao()` chamada à mão em api/relatorios/* — essas rotas
// não passam pelo layout `(app)`, então precisam checar sozinhas e devolver 401 (não
// redirecionar) pra quem não tem sessão. COMPORTAMENTO.md §7.
func (h *Handlers) exigirSessaoManual(w http.ResponseWriter, r *http.Request) bool {
	if h.Sessoes.Ler(r) == nil {
		http.Error(w, "Não autenticado", http.StatusUnauthorized)
		return false
	}
	return true
}

func (h *Handlers) RelatorioFuncionariosXLSX(w http.ResponseWriter, r *http.Request) {
	if !h.exigirSessaoManual(w, r) {
		return
	}
	ctx := r.Context()

	modelo := r.URL.Query().Get("modelo") == "1"

	var linhasExport []planilha.LinhaExportFuncionario
	nome := "funcionarios-modelo.xlsx"
	if !modelo {
		fs, err := h.RepoFuncionarios.Listar(ctx, dominio.FiltrosFuncionario{})
		if err != nil {
			http.Error(w, "Falha ao gerar a planilha", http.StatusInternalServerError)
			return
		}
		sort.Slice(fs, func(i, j int) bool {
			if fs[i].Status != fs[j].Status {
				return fs[i].Status < fs[j].Status
			}
			return fs[i].Nome < fs[j].Nome
		})

		obras, cargos := h.mapaObras(r), h.mapaCargos(r)
		linhasExport = make([]planilha.LinhaExportFuncionario, len(fs))
		for i, f := range fs {
			telefone, cidade, uf := "", "", ""
			if f.Telefone != nil {
				telefone = *f.Telefone
			}
			if f.Cidade != nil {
				cidade = *f.Cidade
			}
			if f.UF != nil {
				uf = *f.UF
			}
			linhasExport[i] = planilha.LinhaExportFuncionario{
				Matricula: f.Matricula, Nome: f.Nome, CPF: dominio.FormatarCPF(f.CPF),
				Obra: nomeOuVazio(f.ObraID, obras), Cargo: nomeOuVazio(f.CargoID, cargos),
				Situacao: dominio.RotuloStatus[f.Status], Admissao: comum.DataBR(&f.AdmitidoEm),
				Telefone: telefone, Cidade: cidade, UF: uf,
			}
		}
		nome = "funcionarios-rh-sc-" + time.Now().Format("2006-01-02") + ".xlsx"
	}

	buf, err := planilha.GerarPlanilhaFuncionarios(linhasExport)
	if err != nil {
		http.Error(w, "Falha ao gerar a planilha", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+nome+`"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(buf)
}

func (h *Handlers) RelatorioResumoPDF(w http.ResponseWriter, r *http.Request) {
	if !h.exigirSessaoManual(w, r) {
		return
	}
	if h.Relatorios == nil {
		http.Error(w, "Falha ao gerar o PDF", http.StatusInternalServerError)
		return
	}

	hoje := time.Now().UTC()
	ind, err := h.Relatorios.Indicadores(r.Context(), hoje)
	if err != nil {
		http.Error(w, "Falha ao gerar o PDF", http.StatusInternalServerError)
		return
	}

	buf, err := relatorio.GerarResumoSST(relatorio.ResumoSST{
		Ativos: ind.Ativos, Afastados: ind.Afastados, Ferias: ind.Ferias,
		TreinamentosVencendo: ind.TreinamentosVencendo, ExamesVencendo: ind.ExamesVencendo,
		NCAbertas: ind.NCAbertas, NCVencidas: ind.NCVencidas, Auditorias: ind.Auditorias,
	}, hoje)
	if err != nil {
		http.Error(w, "Falha ao gerar o PDF", http.StatusInternalServerError)
		return
	}

	nome := "resumo-sst-" + hoje.Format("2006-01-02") + ".pdf"
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+nome+`"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(buf)
}
