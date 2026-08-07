package rh

import (
	"encoding/json"
	"net/http"
	"strconv"

	aplicacao "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/domain/comum"
	tpl "siqueiracampos/servidor/templates/rh"
)

// corpoFichaEpi espelha estoque.FichaEpi (internal/domain/estoque/repositorio.go) — o
// handler não importa o pacote estoque de propósito, RH não conhece Almoxarifado, só o
// contrato JSON entre os dois (COMPORTAMENTO.md §6).
type corpoFichaEpi struct {
	MovimentacaoID string   `json:"movimentacaoId"`
	FuncionarioID  string   `json:"funcionarioId"`
	MaterialCodigo string   `json:"materialCodigo"`
	MaterialNome   string   `json:"materialNome"`
	Unidade        string   `json:"unidade"`
	Quantidade     float64  `json:"quantidade"`
	CA             *string  `json:"ca"`
	ValidadeCA     *string  `json:"validadeCA"`
	EntregueEm     string   `json:"entregueEm"`
	EntreguePor    *string  `json:"entreguePor"`
	Observacao     *string  `json:"observacao"`
}

// IntegracaoEntregaEpiCriar — POST /api/integracao/entregas-epi, SEM prefixo /rh (contrato
// externo com o Almoxarifado, COMPORTAMENTO.md §6). Autenticação por token de máquina, nunca
// cookie de sessão.
func (h *Handlers) IntegracaoEntregaEpiCriar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Integracao.Verificar(r.Header.Get("Authorization")); !ok {
		http.Error(w, `{"erro":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var corpo corpoFichaEpi
	if err := json.NewDecoder(r.Body).Decode(&corpo); err != nil {
		http.Error(w, `{"erro":"corpo inválido"}`, http.StatusBadRequest)
		return
	}

	duplicada, err := h.Epi.Receber(r.Context(), aplicacao.EntradaFichaEpi{
		MovimentacaoID: corpo.MovimentacaoID, FuncionarioID: corpo.FuncionarioID,
		MaterialCodigo: corpo.MaterialCodigo, MaterialNome: corpo.MaterialNome, Unidade: corpo.Unidade,
		Quantidade: corpo.Quantidade, CA: corpo.CA, ValidadeCA: corpo.ValidadeCA, EntregueEm: corpo.EntregueEm,
	})
	if err != nil {
		switch err.(type) {
		case aplicacao.ErroFuncionarioInexistente:
			w.WriteHeader(http.StatusUnprocessableEntity)
			json.NewEncoder(w).Encode(map[string]string{"erro": err.Error()})
		default:
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"erro": err.Error()})
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if duplicada {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"duplicada": true})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]bool{"duplicada": false})
}

// funcionarioIntegracao espelha o JSON de apps/rh/src/app/api/integracao/funcionarios/route.ts
// — propositalmente SEM cpf/salario/endereco/telefone (minimização de dado pessoal entre
// módulos, COMPORTAMENTO.md §6).
type funcionarioIntegracao struct {
	ID               string  `json:"id"`
	Nome             string  `json:"nome"`
	Matricula        string  `json:"matricula"`
	Cargo            *string `json:"cargo"`
	ObraCodigo       *string `json:"obraCodigo"`
	DepartamentoNome *string `json:"departamentoNome"`
	DepartamentoRamo *string `json:"departamentoRamo"`
	NivelObra        *string `json:"nivelObra"`
	Foto             *string `json:"foto"`
}

// IntegracaoFuncionariosListar — GET /api/integracao/funcionarios, SEM prefixo /rh. Consumida
// pelo Almoxarifado e pelo Alojamentos (COMPORTAMENTO.md §6).
func (h *Handlers) IntegracaoFuncionariosListar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Integracao.Verificar(r.Header.Get("Authorization")); !ok {
		http.Error(w, `{"erro":"não autorizado"}`, http.StatusUnauthorized)
		return
	}
	ctx := r.Context()

	fs, err := h.RepoFuncionarios.ListarAtivosParaIntegracao(ctx)
	if err != nil {
		http.Error(w, `{"erro":"falha ao listar funcionários"}`, http.StatusInternalServerError)
		return
	}
	mapaCargos, mapaObras := h.mapaCargos(r), h.mapaObras(r)

	saida := make([]funcionarioIntegracao, len(fs))
	for i, f := range fs {
		fi := funcionarioIntegracao{ID: f.ID, Nome: f.Nome, Matricula: f.Matricula, NivelObra: f.NivelObra, Foto: f.Foto}
		if f.CargoID != nil {
			if nome, ok := mapaCargos[*f.CargoID]; ok {
				fi.Cargo = &nome
			}
		}
		if f.ObraID != nil {
			if codigo, ok := mapaObras[*f.ObraID]; ok {
				fi.ObraCodigo = &codigo
			}
		}
		if f.DepartamentoID != nil {
			if d, _ := h.RepoDepartamentos.BuscarPorID(ctx, *f.DepartamentoID); d != nil {
				fi.DepartamentoNome = &d.Nome
				if d.PaiID != nil {
					if ramo, _ := h.RepoDepartamentos.BuscarPorID(ctx, *d.PaiID); ramo != nil {
						fi.DepartamentoRamo = &ramo.Nome
					}
				}
			}
		}
		saida[i] = fi
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"funcionarios": saida})
}

type indicadorIntegracao struct {
	Rotulo string `json:"rotulo"`
	Valor  string `json:"valor"`
	Tom    string `json:"tom"`
}

// IntegracaoResumo — GET /api/integracao/resumo, SEM prefixo /rh. Consumida pelo Portal para
// o dashboard central — indicadores já formatados (COMPORTAMENTO.md §6).
func (h *Handlers) IntegracaoResumo(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Integracao.Verificar(r.Header.Get("Authorization")); !ok {
		http.Error(w, `{"erro":"não autorizado"}`, http.StatusUnauthorized)
		return
	}
	ind, err := h.Dashboard.Carregar(r.Context(), h.contarObrasAtivasSeguro(r))
	if err != nil {
		http.Error(w, `{"erro":"falha ao montar o resumo"}`, http.StatusInternalServerError)
		return
	}

	tomAfastados := "bom"
	if ind.Afastados > 0 {
		tomAfastados = "alerta"
	}
	tomIncompletos := "bom"
	if ind.CadastrosIncompletos > 0 {
		tomIncompletos = "perigo"
	}

	indicadores := []indicadorIntegracao{
		{Rotulo: "Funcionários ativos", Valor: strconv.Itoa(ind.Ativos), Tom: "destaque"},
		{Rotulo: "Afastados", Valor: strconv.Itoa(ind.Afastados), Tom: tomAfastados},
		{Rotulo: "Em férias", Valor: strconv.Itoa(ind.Ferias), Tom: "neutro"},
		{Rotulo: "Cadastro incompleto", Valor: strconv.Itoa(ind.CadastrosIncompletos), Tom: tomIncompletos},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"indicadores": indicadores})
}

// ListarEpis — GET /rh/epis, só leitura (COMPORTAMENTO.md §6).
func (h *Handlers) ListarEpis(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	entregas, err := h.Epi.Listar(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	linhas := make([]tpl.LinhaEpi, len(entregas))
	for i, e := range entregas {
		ca := ""
		if e.CA != nil {
			ca = *e.CA
		}
		linhas[i] = tpl.LinhaEpi{Funcionario: e.FuncionarioNome, Material: e.MaterialNome, CA: ca, Data: comum.DataBR(&e.EntregueEm)}
	}
	tpl.Epis(linhas, h.URLEstoque).Render(ctx, w)
}

func (h *Handlers) contarObrasAtivasSeguro(r *http.Request) int {
	if h.ContarObrasAtivas == nil {
		return 0
	}
	n, err := h.ContarObrasAtivas(r.Context())
	if err != nil {
		return 0
	}
	return n
}
