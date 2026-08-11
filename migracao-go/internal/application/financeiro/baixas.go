package financeiro

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/financeiro"
)

type GerenciadorBaixas struct {
	Repo  dominio.Repositorio
	Agora func() time.Time
}
type EntradaBaixa struct{ TituloID, ParcelaID, ContaID, ValorCentavos, OcorridoEm, Documento, Observacao, ChaveIdempotencia, RegistradoPor, RegistradoPorID string }
type EntradaEstorno struct{ MovimentoID, ChaveIdempotencia, Observacao, RegistradoPor, RegistradoPorID string }
type ResultadoBaixa struct {
	Duplicada bool
	Status    dominio.StatusTitulo
}

func ponteiro(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func (g *GerenciadorBaixas) Registrar(ctx context.Context, e EntradaBaixa) (ResultadoBaixa, error) {
	if strings.TrimSpace(e.TituloID) == "" || strings.TrimSpace(e.ChaveIdempotencia) == "" {
		return ResultadoBaixa{}, fmt.Errorf("título e chave de idempotência são obrigatórios")
	}
	if strings.TrimSpace(e.ContaID) == "" {
		return ResultadoBaixa{}, fmt.Errorf("conta financeira é obrigatória")
	}
	valor, err := strconv.ParseInt(strings.TrimSpace(e.ValorCentavos), 10, 64)
	if err != nil || valor <= 0 {
		return ResultadoBaixa{}, dominio.ErrValorInvalido
	}
	t, err := g.Repo.BuscarTitulo(ctx, e.TituloID)
	if err != nil {
		return ResultadoBaixa{}, err
	}
	if t == nil {
		return ResultadoBaixa{}, fmt.Errorf("título não encontrado")
	}
	parcelaID := strings.TrimSpace(e.ParcelaID)
	if parcelaID == "" && len(t.Parcelas) == 1 {
		parcelaID = t.Parcelas[0].ID
	}
	if parcelaID == "" && len(t.Parcelas) > 1 {
		return ResultadoBaixa{}, fmt.Errorf("informe a parcela que está sendo baixada")
	}
	var ocorrido time.Time
	if strings.TrimSpace(e.OcorridoEm) == "" {
		if g.Agora != nil {
			ocorrido = g.Agora()
		} else {
			ocorrido = time.Now().UTC()
		}
	} else {
		ocorrido, err = time.Parse(time.DateOnly, e.OcorridoEm)
		if err != nil {
			return ResultadoBaixa{}, fmt.Errorf("data da baixa inválida")
		}
	}
	if fechamento, ok := g.Repo.(dominio.FechamentoRepositorio); ok {
		fechada, err := fechamento.CompetenciaFechada(ctx, ocorrido.Format("2006-01"))
		if err != nil {
			return ResultadoBaixa{}, err
		}
		if fechada {
			return ResultadoBaixa{}, dominio.ErrCompetenciaFechada
		}
	}
	tipo := "PAGAMENTO"
	if t.Tipo == dominio.TituloReceber {
		tipo = "RECEBIMENTO"
	}
	m := dominio.Movimento{TituloID: t.ID, ParcelaID: ponteiro(parcelaID), ContaID: ponteiro(e.ContaID), Tipo: tipo, Valor: dominio.Centavos(valor), OcorridoEm: ocorrido, Documento: ponteiro(e.Documento), Observacao: ponteiro(e.Observacao), ChaveIdempotencia: strings.TrimSpace(e.ChaveIdempotencia), RegistradoPor: e.RegistradoPor, RegistradoPorID: e.RegistradoPorID}
	duplicada, status, err := g.Repo.RegistrarBaixa(ctx, m)
	if err != nil {
		return ResultadoBaixa{}, err
	}
	return ResultadoBaixa{Duplicada: duplicada, Status: status}, nil
}

func (g *GerenciadorBaixas) Estornar(ctx context.Context, e EntradaEstorno) (ResultadoBaixa, error) {
	if strings.TrimSpace(e.MovimentoID) == "" || strings.TrimSpace(e.ChaveIdempotencia) == "" {
		return ResultadoBaixa{}, fmt.Errorf("movimento e chave de idempotência são obrigatórios")
	}
	repo, ok := g.Repo.(dominio.EstornoRepositorio)
	if !ok {
		return ResultadoBaixa{}, fmt.Errorf("estorno financeiro não suportado pelo repositório")
	}
	duplicado, status, err := repo.EstornarMovimento(ctx, strings.TrimSpace(e.MovimentoID), strings.TrimSpace(e.ChaveIdempotencia), strings.TrimSpace(e.Observacao), strings.TrimSpace(e.RegistradoPorID), strings.TrimSpace(e.RegistradoPor))
	if err != nil {
		return ResultadoBaixa{}, err
	}
	return ResultadoBaixa{Duplicada: duplicado, Status: status}, nil
}
