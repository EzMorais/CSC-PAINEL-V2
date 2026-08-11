package financeiro

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/financeiro"
	tpl "siqueiracampos/servidor/templates/financeiro"
)

func TestAbasFinanceirasRenderizam(t *testing.T) {
	agora := time.Date(2026, 8, 11, 0, 0, 0, 0, time.UTC)
	casos := map[string]func() error{
		"dashboard": func() error {
			w := httptest.NewRecorder()
			return tpl.Dashboard(dominio.ResumoOperacional{}, nil, []dominio.IntegracaoFiscal{{Provedor: "SEFAZ", Rotulo: "NF-e", Ambiente: "HOMOLOGACAO"}}, nil).Render(context.Background(), w)
		},
		"faturamento": func() error {
			w := httptest.NewRecorder()
			return tpl.Faturamento([]dominio.Faturamento{{ID: "f", Numero: "FAT-1", ClienteNome: "Cliente", Emissao: agora, ValorLiquido: 100, ModeloFiscal: "NFE", Status: "RASCUNHO"}}, "2026-08-11", "x").Render(context.Background(), w)
		},
		"fiscal": func() error {
			w := httptest.NewRecorder()
			return tpl.Fiscal([]dominio.DocumentoFiscal{{ID: "d", Direcao: "SAIDA", Modelo: "NFE", Emissor: "SEFAZ", Status: "PENDENTE", ContraparteNome: "Cliente", Emissao: agora, Valor: 100}}).Render(context.Background(), w)
		},
		"pagar": func() error {
			w := httptest.NewRecorder()
			return tpl.Titulos("pagar", dominio.TituloPagar, []dominio.Titulo{{ID: "t", Numero: "CP-1", ContraparteNome: "Fornecedor", Descricao: "Conta", ValorTotal: 100, ValorAberto: 100, Status: dominio.TituloAprovado, Parcelas: []dominio.Parcela{{ID: "p", Vencimento: agora}}}}, nil, "2026-08-11", "x").Render(context.Background(), w)
		},
		"receber": func() error {
			w := httptest.NewRecorder()
			return tpl.Titulos("receber", dominio.TituloReceber, nil, nil, "2026-08-11", "x").Render(context.Background(), w)
		},
	}
	for aba, executar := range casos {
		if err := executar(); err != nil {
			t.Fatalf("aba %s: %v", aba, err)
		}
	}
}
