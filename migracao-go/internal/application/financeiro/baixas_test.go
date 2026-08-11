package financeiro

import (
	"context"
	"errors"
	"testing"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/financeiro"
)

type repoFake struct {
	titulo     *dominio.Titulo
	chaves     map[string]bool
	movimentos []dominio.Movimento
}

func (r *repoFake) BuscarTitulo(context.Context, string) (*dominio.Titulo, error) {
	c := *r.titulo
	return &c, nil
}
func (r *repoFake) RegistrarBaixa(_ context.Context, m dominio.Movimento) (bool, dominio.StatusTitulo, error) {
	if r.chaves[m.ChaveIdempotencia] {
		return true, r.titulo.Status, nil
	}
	s, err := r.titulo.StatusAposBaixa(m.Valor)
	if err != nil {
		return false, "", err
	}
	r.chaves[m.ChaveIdempotencia] = true
	r.movimentos = append(r.movimentos, m)
	r.titulo.ValorAberto -= m.Valor
	r.titulo.Status = s
	return false, s, nil
}
func gerenciador(aberto dominio.Centavos) *GerenciadorBaixas {
	r := &repoFake{titulo: &dominio.Titulo{ID: "t1", Tipo: dominio.TituloPagar, Status: dominio.TituloAprovado, ValorTotal: 10000, ValorAberto: aberto}, chaves: map[string]bool{}}
	return &GerenciadorBaixas{Repo: r, Agora: func() time.Time { return time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC) }}
}

func TestBaixaParcialEIntegral(t *testing.T) {
	g := gerenciador(10000)
	r := g.Repo.(*repoFake)
	res, err := g.Registrar(context.Background(), EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "4000", ChaveIdempotencia: "pag-1", RegistradoPor: "Ana"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != dominio.TituloParcial || r.titulo.ValorAberto != 6000 {
		t.Fatalf("parcial: %+v titulo=%+v", res, r.titulo)
	}
	res, err = g.Registrar(context.Background(), EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "6000", ChaveIdempotencia: "pag-2"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != dominio.TituloLiquidado || r.titulo.ValorAberto != 0 {
		t.Fatalf("integral: %+v titulo=%+v", res, r.titulo)
	}
}
func TestBaixaIdempotenteNaoDuplicaMovimento(t *testing.T) {
	g := gerenciador(5000)
	r := g.Repo.(*repoFake)
	e := EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "1000", ChaveIdempotencia: "webhook-123"}
	if _, err := g.Registrar(context.Background(), e); err != nil {
		t.Fatal(err)
	}
	res, err := g.Registrar(context.Background(), e)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Duplicada || len(r.movimentos) != 1 || r.titulo.ValorAberto != 4000 {
		t.Fatalf("idempotência falhou: %+v", r)
	}
}
func TestBaixaRecusaValorMaiorQueAberto(t *testing.T) {
	g := gerenciador(1000)
	_, err := g.Registrar(context.Background(), EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "1001", ChaveIdempotencia: "x"})
	if !errors.Is(err, dominio.ErrValorExcedeAberto) {
		t.Fatalf("erro = %v", err)
	}
}
func TestBaixaRecusaTituloSemAprovacao(t *testing.T) {
	g := gerenciador(1000)
	g.Repo.(*repoFake).titulo.Status = dominio.TituloPendente
	_, err := g.Registrar(context.Background(), EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "1000", ChaveIdempotencia: "x"})
	if !errors.Is(err, dominio.ErrTituloNaoLiquidavel) {
		t.Fatalf("erro = %v", err)
	}
}

func TestReentregaDepoisDeLiquidacaoIntegralContinuaIdempotente(t *testing.T) {
	g := gerenciador(1000)
	e := EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "1000", ChaveIdempotencia: "confirmacao-banco"}
	if _, err := g.Registrar(context.Background(), e); err != nil {
		t.Fatal(err)
	}
	res, err := g.Registrar(context.Background(), e)
	if err != nil || !res.Duplicada || res.Status != dominio.TituloLiquidado {
		t.Fatalf("resultado=%+v erro=%v", res, err)
	}
}

func TestDataInvalidaNaoViraHojeSilenciosamente(t *testing.T) {
	g := gerenciador(1000)
	_, err := g.Registrar(context.Background(), EntradaBaixa{TituloID: "t1", ContaID: "c1", ValorCentavos: "100", OcorridoEm: "31/02/2026", ChaveIdempotencia: "x"})
	if err == nil {
		t.Fatal("data inválida foi aceita")
	}
}
