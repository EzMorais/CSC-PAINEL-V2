package estoque

import (
	"context"
	"fmt"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
)

// Fakes em memória compartilhados pelos testes deste pacote — implementam as portas de
// repositório (internal/domain/estoque/repositorio.go) sem precisar de banco.

type materiaisFake struct {
	porID  map[string]*dominio.Material
	saldos map[string]float64
}

func novoMateriaisFake() *materiaisFake {
	return &materiaisFake{porID: map[string]*dominio.Material{}, saldos: map[string]float64{}}
}

func (f *materiaisFake) adicionar(m *dominio.Material, saldo float64) {
	f.porID[m.ID] = m
	f.saldos[m.ID] = saldo
}

func (f *materiaisFake) BuscarPorID(ctx context.Context, id string) (*dominio.Material, error) {
	return f.porID[id], nil
}
func (f *materiaisFake) Listar(ctx context.Context, filtros dominio.FiltrosMaterial) ([]dominio.Material, error) {
	return nil, nil
}
func (f *materiaisFake) Criar(ctx context.Context, m *dominio.Material) error {
	f.porID[m.ID] = m
	return nil
}
func (f *materiaisFake) Atualizar(ctx context.Context, m *dominio.Material) error {
	f.porID[m.ID] = m
	return nil
}
func (f *materiaisFake) AtualizarAtivo(ctx context.Context, id string, ativo bool) error {
	if m, ok := f.porID[id]; ok {
		m.Ativo = ativo
	}
	return nil
}
func (f *materiaisFake) UltimoCodigo(ctx context.Context) (string, error) { return "", nil }
func (f *materiaisFake) SaldoPorMaterial(ctx context.Context) (map[string]float64, error) {
	return f.saldos, nil
}
func (f *materiaisFake) SaldoDoMaterial(ctx context.Context, materialID string) (float64, error) {
	return f.saldos[materialID], nil
}
func (f *materiaisFake) UltimoPrecoPorMaterial(ctx context.Context) (map[string]float64, error) {
	return nil, nil
}

type movimentacoesFake struct {
	criadas []dominio.Movimentacao
}

func (f *movimentacoesFake) BuscarPorID(ctx context.Context, id string) (*dominio.Movimentacao, error) {
	for i := range f.criadas {
		if f.criadas[i].ID == id {
			return &f.criadas[i], nil
		}
	}
	return nil, nil
}
func (f *movimentacoesFake) Listar(ctx context.Context, filtros dominio.FiltrosMovimentacao, limite int) ([]dominio.Movimentacao, error) {
	return f.criadas, nil
}
func (f *movimentacoesFake) Criar(ctx context.Context, m *dominio.Movimentacao) error {
	m.ID = fmt.Sprintf("mov-%d", len(f.criadas)+1)
	f.criadas = append(f.criadas, *m)
	return nil
}
func (f *movimentacoesFake) MarcarSincronizada(ctx context.Context, id string, erro *string) error {
	return nil
}
func (f *movimentacoesFake) ListarFichasPendentes(ctx context.Context) ([]dominio.Movimentacao, error) {
	return nil, nil
}
func (f *movimentacoesFake) Recentes(ctx context.Context, limite int) ([]dominio.Movimentacao, error) {
	return nil, nil
}
func (f *movimentacoesFake) ContarPorTipoDesde(ctx context.Context, tipo dominio.TipoMovimentacao, desde string) (int, error) {
	return 0, nil
}
func (f *movimentacoesFake) ConsumoPorObra(ctx context.Context) ([]dominio.LinhaConsumoObra, error) {
	return nil, nil
}

type aprovacoesFake struct {
	porID   map[string]*dominio.Aprovacao
	criadas []dominio.Aprovacao
}

func novoAprovacoesFake() *aprovacoesFake {
	return &aprovacoesFake{porID: map[string]*dominio.Aprovacao{}}
}

func (f *aprovacoesFake) BuscarPorID(ctx context.Context, id string) (*dominio.Aprovacao, error) {
	return f.porID[id], nil
}
func (f *aprovacoesFake) Listar(ctx context.Context, status string) ([]dominio.Aprovacao, error) {
	return f.criadas, nil
}
func (f *aprovacoesFake) ContarPendentes(ctx context.Context) (int, error) {
	n := 0
	for _, a := range f.porID {
		if a.Status == dominio.AprovacaoPendente {
			n++
		}
	}
	return n, nil
}
func (f *aprovacoesFake) Criar(ctx context.Context, a *dominio.Aprovacao) error {
	a.ID = fmt.Sprintf("apr-%d", len(f.criadas)+1)
	a.Status = dominio.AprovacaoPendente
	f.porID[a.ID] = a
	f.criadas = append(f.criadas, *a)
	return nil
}
func (f *aprovacoesFake) Decidir(ctx context.Context, id string, status dominio.StatusAprovacao, aprovadorID, aprovadorNome string, motivoRejeicao, referenciaID *string) error {
	a, ok := f.porID[id]
	if !ok {
		return fmt.Errorf("aprovação %s não encontrada", id)
	}
	a.Status = status
	a.AprovadorID = &aprovadorID
	a.AprovadorNome = &aprovadorNome
	a.MotivoRejeicao = motivoRejeicao
	a.ReferenciaID = referenciaID
	return nil
}

type configuracaoFake struct{ cfg *dominio.ConfiguracaoEmail }

func (f *configuracaoFake) Obter(ctx context.Context) (*dominio.ConfiguracaoEmail, error) {
	return f.cfg, nil
}
func (f *configuracaoFake) Salvar(ctx context.Context, c *dominio.ConfiguracaoEmail) error {
	f.cfg = c
	return nil
}
func (f *configuracaoFake) MarcarTestada(ctx context.Context) error { return nil }
func (f *configuracaoFake) AtualizarAtivo(ctx context.Context, ativo bool) error { return nil }

type clienteRHFake struct{ chamado bool }

func (f *clienteRHFake) EnviarFichaEpi(ctx context.Context, ficha dominio.FichaEpi) dominio.ResultadoRH {
	f.chamado = true
	return dominio.ResultadoRH{OK: true}
}
