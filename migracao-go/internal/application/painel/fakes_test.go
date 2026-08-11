package painel

import (
	"context"
	"fmt"
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
	dominio "siqueiracampos/servidor/internal/domain/painel"
)

// Fakes em memória — implementam as portas de Obra/Fornecedor (internal/domain/cadastro) e
// Locação (internal/domain/painel/repositorio.go) pra testar a importação sem banco.

type obrasFake struct{ lista []cadastro.Obra }

func (f *obrasFake) BuscarPorID(ctx context.Context, id string) (*cadastro.Obra, error) {
	for i := range f.lista {
		if f.lista[i].ID == id {
			return &f.lista[i], nil
		}
	}
	return nil, nil
}
func (f *obrasFake) BuscarPorCodigo(ctx context.Context, codigo string) (*cadastro.Obra, error) {
	for i := range f.lista {
		if f.lista[i].Codigo == codigo {
			return &f.lista[i], nil
		}
	}
	return nil, nil
}
func (f *obrasFake) Listar(ctx context.Context) ([]cadastro.Obra, error)       { return f.lista, nil }
func (f *obrasFake) ListarAtivas(ctx context.Context) ([]cadastro.Obra, error) { return f.lista, nil }
func (f *obrasFake) Criar(ctx context.Context, o *cadastro.Obra) error {
	o.ID = fmt.Sprintf("obra-%d", len(f.lista)+1)
	f.lista = append(f.lista, *o)
	return nil
}
func (f *obrasFake) Atualizar(ctx context.Context, o *cadastro.Obra) error       { return nil }
func (f *obrasFake) AtualizarAtiva(ctx context.Context, id string, a bool) error { return nil }
func (f *obrasFake) ContarLocacoesEmAberto(ctx context.Context, obraID string) (int, error) {
	return 0, nil
}

type fornecedoresFake struct{ lista []cadastro.Fornecedor }

func (f *fornecedoresFake) BuscarPorID(ctx context.Context, id string) (*cadastro.Fornecedor, error) {
	for i := range f.lista {
		if f.lista[i].ID == id {
			return &f.lista[i], nil
		}
	}
	return nil, nil
}
func (f *fornecedoresFake) BuscarPorNomeNormalizado(ctx context.Context, nome string) (*cadastro.Fornecedor, error) {
	for i := range f.lista {
		if dominio.NormalizarTexto(f.lista[i].Nome) == nome {
			return &f.lista[i], nil
		}
	}
	return nil, nil
}
func (f *fornecedoresFake) Listar(ctx context.Context) ([]cadastro.Fornecedor, error) {
	return f.lista, nil
}
func (f *fornecedoresFake) ListarAtivos(ctx context.Context) ([]cadastro.Fornecedor, error) {
	return f.lista, nil
}
func (f *fornecedoresFake) DonosDeAliases(ctx context.Context, aliases []string, exceto string) ([]cadastro.AliasDono, error) {
	return nil, nil
}
func (f *fornecedoresFake) Criar(ctx context.Context, forn *cadastro.Fornecedor) error {
	forn.ID = fmt.Sprintf("forn-%d", len(f.lista)+1)
	f.lista = append(f.lista, *forn)
	return nil
}
func (f *fornecedoresFake) Atualizar(ctx context.Context, forn *cadastro.Fornecedor) error {
	return nil
}
func (f *fornecedoresFake) AtualizarAtivo(ctx context.Context, id string, ativo bool) error {
	return nil
}
func (f *fornecedoresFake) MapaPorApelidoOuNome(ctx context.Context) (map[string]string, error) {
	m := map[string]string{}
	for _, forn := range f.lista {
		m[dominio.NormalizarTexto(forn.Nome)] = forn.ID
		for _, a := range forn.Aliases {
			m[dominio.NormalizarTexto(a)] = forn.ID
		}
	}
	return m, nil
}

type locacoesFake struct {
	chaves  map[string]bool
	criadas []dominio.ItemImportacao
}

func (f *locacoesFake) BuscarPorID(ctx context.Context, id string) (*dominio.Locacao, error) {
	return nil, nil
}
func (f *locacoesFake) Listar(ctx context.Context, filtros dominio.FiltrosLocacao, hoje time.Time) ([]dominio.Locacao, error) {
	return nil, nil
}
func (f *locacoesFake) Criar(ctx context.Context, l *dominio.Locacao, mov dominio.Movimentacao) error {
	return nil
}
func (f *locacoesFake) Atualizar(ctx context.Context, l *dominio.Locacao, mov dominio.Movimentacao) error {
	return nil
}
func (f *locacoesFake) ContarPorObra(ctx context.Context, obraID string, emAberto bool) (int, error) {
	return 0, nil
}
func (f *locacoesFake) ReclassificarEmLote(ctx context.Context, ids []string, obraDestinoID, obraDestinoCodigo string) error {
	return nil
}

// ChavesExistentes e CriarLote são os únicos métodos de verdade exercidos pelos testes de
// importação — a chave é recalculada aqui do mesmo jeito que o banco real faria, simulando um
// livro-razão persistente entre duas chamadas (prévia → confirmar → reimportar).
func (f *locacoesFake) ChavesExistentes(ctx context.Context) (map[string]bool, error) {
	if f.chaves == nil {
		return map[string]bool{}, nil
	}
	return f.chaves, nil
}
func (f *locacoesFake) CriarLote(ctx context.Context, itens []dominio.ItemImportacao) (int, error) {
	if f.chaves == nil {
		f.chaves = map[string]bool{}
	}
	for _, it := range itens {
		chave := dominio.ChaveIdempotencia(it.ObraID, it.Descricao, it.TrCodigo, it.DataInicio, it.NumeroOrigem)
		f.chaves[chave] = true
	}
	f.criadas = append(f.criadas, itens...)
	return len(itens), nil
}
func (f *locacoesFake) ValorItemDatasNaoDevolvidas(ctx context.Context) ([]dominio.ValorEDatas, error) {
	return nil, nil
}
func (f *locacoesFake) ContarNaoDevolvidas(ctx context.Context) (int, error) { return 0, nil }
func (f *locacoesFake) ContarVencemEmDias(ctx context.Context, ate, hoje time.Time) (int, error) {
	return 0, nil
}
func (f *locacoesFake) ContarVencidas(ctx context.Context, hoje time.Time) (int, error) {
	return 0, nil
}
func (f *locacoesFake) ContarPorEstado(ctx context.Context, estado dominio.Estado, emAberto bool) (int, error) {
	return 0, nil
}
func (f *locacoesFake) ContarAConfirmar(ctx context.Context) (int, error) { return 0, nil }
func (f *locacoesFake) PorFornecedorNaoDevolvidas(ctx context.Context) ([]dominio.LinhaAgregada, error) {
	return nil, nil
}
func (f *locacoesFake) PorObraNaoDevolvidas(ctx context.Context) ([]dominio.LinhaAgregada, error) {
	return nil, nil
}
func (f *locacoesFake) VencimentosProximos(ctx context.Context, ate time.Time, limite int) ([]dominio.Locacao, error) {
	return nil, nil
}
func (f *locacoesFake) ParaExportarExcel(ctx context.Context) ([]dominio.ObraComLocacoes, error) {
	return nil, nil
}
func (f *locacoesFake) ParaExportarPDF(ctx context.Context) ([]dominio.ObraComLocacoes, error) {
	return nil, nil
}
