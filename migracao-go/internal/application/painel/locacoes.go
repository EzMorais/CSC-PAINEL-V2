package painel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/painel"
)

type GerenciadorLocacoes struct {
	Locacoes dominio.LocacaoRepositorio
	Obras    dominio.ObraRepositorio
}

type EntradaLocacao struct {
	ObraID       string
	Descricao    string
	TrCodigo     string
	FornecedorID string
	Quantidade   int
	DataInicio   *time.Time
	DataFim      *time.Time
	ValorItem    *float64
	Observacoes  string
}

func validarEntradaLocacao(e EntradaLocacao, exigirCampos bool) (erros []string) {
	if exigirCampos && strings.TrimSpace(e.ObraID) == "" {
		erros = append(erros, "Selecione a obra.")
	}
	if exigirCampos && len(strings.TrimSpace(e.Descricao)) < 2 {
		erros = append(erros, "Informe o equipamento.")
	}
	if exigirCampos && e.DataInicio == nil {
		erros = append(erros, "Data de início inválida.")
	}
	if exigirCampos && e.DataFim == nil {
		erros = append(erros, "Data de fim inválida.")
	}
	return
}

// Criar espelha `criarLocacao` — ver COMPORTAMENTO.md §4.3.
func (g *GerenciadorLocacoes) Criar(ctx context.Context, e EntradaLocacao) (*dominio.Locacao, error) {
	if erros := validarEntradaLocacao(e, true); len(erros) > 0 {
		return nil, erroValidacao(erros...)
	}
	if e.DataFim.Before(*e.DataInicio) {
		return nil, erroValidacao("A data de fim é anterior à de início.")
	}

	quantidade := e.Quantidade
	if quantidade < 1 {
		quantidade = 1
	}

	l := &dominio.Locacao{
		ObraID: e.ObraID, Descricao: strings.ToUpper(strings.TrimSpace(e.Descricao)),
		TrCodigo: ponteiro(e.TrCodigo), Quantidade: quantidade, Estado: dominio.EstadoOK,
		Observacoes: ponteiro(e.Observacoes), DataInicio: e.DataInicio, DataFim: e.DataFim,
		ValorItem: e.ValorItem, FornecedorID: ponteiro(e.FornecedorID),
	}
	mov := dominio.Movimentacao{
		Tipo:            dominio.MovRegistro,
		DescricaoHumana: fmt.Sprintf("Registrada de %s a %s", dominio.DataBR(e.DataInicio), dominio.DataBR(e.DataFim)),
	}
	if err := g.Locacoes.Criar(ctx, l, mov); err != nil {
		return nil, err
	}
	return l, nil
}

// EntradaEdicao é parcial — campo nil/vazio significa "não alterar", espelhando o schema
// `.partial()` de editarLocacao em Next.js.
type EntradaEdicao struct {
	ObraID           *string
	Descricao        *string
	TrCodigo         *string
	FornecedorID     *string
	Quantidade       *int
	DataInicio       *time.Time
	DataFim          *time.Time
	ValorItem        *float64
	AlterarValorItem bool // false = não mexe no campo; true = grava ValorItem (mesmo nil, pra limpar)
	Observacoes      *string
}

// Editar espelha `editarLocacao` — ver COMPORTAMENTO.md §4.3: valida a data contra o que
// FICARÁ gravado (mistura do que veio com o que já existia), não só contra o formulário.
func (g *GerenciadorLocacoes) Editar(ctx context.Context, id string, e EntradaEdicao) error {
	antes, err := g.Locacoes.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if antes == nil {
		return erroValidacao("Locação não encontrada.")
	}

	depois := *antes
	antesJSON, _ := json.Marshal(camposEditaveis(antes))

	if e.ObraID != nil {
		depois.ObraID = *e.ObraID
	}
	if e.Descricao != nil {
		d := strings.TrimSpace(*e.Descricao)
		if len(d) > 0 {
			depois.Descricao = strings.ToUpper(d)
		}
	}
	if e.TrCodigo != nil {
		depois.TrCodigo = ponteiro(*e.TrCodigo)
	}
	if e.FornecedorID != nil {
		depois.FornecedorID = ponteiro(*e.FornecedorID)
	}
	if e.Quantidade != nil {
		depois.Quantidade = *e.Quantidade
	}
	if e.DataInicio != nil {
		depois.DataInicio = e.DataInicio
	}
	if e.DataFim != nil {
		depois.DataFim = e.DataFim
	}
	if e.AlterarValorItem {
		depois.ValorItem = e.ValorItem
	}
	if e.Observacoes != nil {
		depois.Observacoes = ponteiro(*e.Observacoes)
	}

	if depois.DataInicio != nil && depois.DataFim != nil && depois.DataFim.Before(*depois.DataInicio) {
		return erroValidacao("A data de fim ficaria anterior à de início.")
	}

	depoisJSON, _ := json.Marshal(camposEditaveis(&depois))
	antesStr, depoisStr := string(antesJSON), string(depoisJSON)
	mov := dominio.Movimentacao{Tipo: dominio.MovEdicao, DescricaoHumana: "Dados editados", PayloadAntes: &antesStr, PayloadDepois: &depoisStr}

	return g.Locacoes.Atualizar(ctx, &depois, mov)
}

func camposEditaveis(l *dominio.Locacao) map[string]any {
	return map[string]any{
		"obraId": l.ObraID, "descricao": l.Descricao, "trCodigo": l.TrCodigo,
		"fornecedorId": l.FornecedorID, "quantidade": l.Quantidade,
		"dataInicio": dominio.DataBR(l.DataInicio), "dataFim": dominio.DataBR(l.DataFim),
		"valorItem": l.ValorItem, "observacoes": l.Observacoes,
	}
}

// Renovar espelha `renovarLocacao` — ver COMPORTAMENTO.md §4.3. diasExtras nil usa a
// duração atual da locação (fim-início) como o tanto a acrescentar.
func (g *GerenciadorLocacoes) Renovar(ctx context.Context, id string, diasExtras *int) (time.Time, error) {
	l, err := g.Locacoes.BuscarPorID(ctx, id)
	if err != nil {
		return time.Time{}, err
	}
	if l == nil {
		return time.Time{}, erroValidacao("Locação não encontrada.")
	}
	if l.DevolvidaEm != nil {
		return time.Time{}, erroValidacao("Locação já devolvida — não pode ser renovada.")
	}
	if l.DataInicio == nil || l.DataFim == nil {
		return time.Time{}, erroValidacao("Locação sem datas — edite antes de renovar.")
	}

	dias := dominio.DuracaoEmDias(l.DataInicio, l.DataFim)
	if diasExtras != nil {
		dias = *diasExtras
	}
	if dias <= 0 {
		return time.Time{}, erroValidacao("Período de renovação inválido.")
	}

	novaData := l.DataFim.UTC().AddDate(0, 0, dias)
	antesJSON, _ := json.Marshal(map[string]any{"dataFim": dominio.DataBR(l.DataFim)})
	depoisJSON, _ := json.Marshal(map[string]any{"dataFim": dominio.DataBR(&novaData)})
	antesStr, depoisStr := string(antesJSON), string(depoisJSON)

	l.DataFim = &novaData
	mov := dominio.Movimentacao{
		Tipo:            dominio.MovRenovacao,
		DescricaoHumana: fmt.Sprintf("Renovada por %d dias — novo fim %s", dias, dominio.DataBR(&novaData)),
		PayloadAntes:    &antesStr, PayloadDepois: &depoisStr,
	}
	if err := g.Locacoes.Atualizar(ctx, l, mov); err != nil {
		return time.Time{}, err
	}
	return novaData, nil
}

// Devolver espelha `devolverLocacao` — ver COMPORTAMENTO.md §4.3: a linha NUNCA é apagada
// nem recriada, só `devolvidaEm` é preenchida. É o comportamento mais importante do módulo.
func (g *GerenciadorLocacoes) Devolver(ctx context.Context, id string, dataDevolucao time.Time, motivo string) error {
	l, err := g.Locacoes.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if l == nil {
		return erroValidacao("Locação não encontrada.")
	}
	if l.DevolvidaEm != nil {
		return erroValidacao("Locação já devolvida.")
	}

	descricao := fmt.Sprintf("Devolvida em %s", dominio.DataBR(&dataDevolucao))
	if l.DataInicio != nil {
		permanencia := dominio.DuracaoEmDias(l.DataInicio, &dataDevolucao)
		descricao += fmt.Sprintf(" — permaneceu %d dias na obra", permanencia)
	}
	if motivo = strings.TrimSpace(motivo); motivo != "" {
		descricao += " · " + motivo
	}

	l.DevolvidaEm = &dataDevolucao
	mov := dominio.Movimentacao{Tipo: dominio.MovDevolucao, DescricaoHumana: descricao}
	return g.Locacoes.Atualizar(ctx, l, mov)
}

// Transferir espelha `transferirLocacao` — ver COMPORTAMENTO.md §4.3.
func (g *GerenciadorLocacoes) Transferir(ctx context.Context, id, obraDestinoID string, dataInicio, dataFim time.Time, motivo string) error {
	l, err := g.Locacoes.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if l == nil {
		return erroValidacao("Locação não encontrada.")
	}
	if l.DevolvidaEm != nil {
		return erroValidacao("Locação devolvida não pode ser transferida.")
	}
	if l.ObraID == obraDestinoID {
		return erroValidacao("A obra de destino é a mesma da origem.")
	}
	if dataFim.Before(dataInicio) {
		return erroValidacao("A data de fim é anterior à de início.")
	}

	destino, err := g.Obras.BuscarPorID(ctx, obraDestinoID)
	if err != nil {
		return err
	}
	if destino == nil {
		return erroValidacao("Obra de destino não encontrada.")
	}

	descricao := fmt.Sprintf("Transferida de %s para %s — novo período %s a %s",
		l.ObraCodigo, destino.Codigo, dominio.DataBR(&dataInicio), dominio.DataBR(&dataFim))
	if motivo = strings.TrimSpace(motivo); motivo != "" {
		descricao += " · " + motivo
	}
	antesJSON, _ := json.Marshal(map[string]any{"obra": l.ObraCodigo, "dataInicio": dominio.DataBR(l.DataInicio), "dataFim": dominio.DataBR(l.DataFim)})
	depoisJSON, _ := json.Marshal(map[string]any{"obra": destino.Codigo, "dataInicio": dominio.DataBR(&dataInicio), "dataFim": dominio.DataBR(&dataFim)})
	antesStr, depoisStr := string(antesJSON), string(depoisJSON)

	l.ObraID = obraDestinoID
	l.DataInicio, l.DataFim = &dataInicio, &dataFim
	l.ObraAConfirmar = false
	mov := dominio.Movimentacao{Tipo: dominio.MovTransferencia, DescricaoHumana: descricao, PayloadAntes: &antesStr, PayloadDepois: &depoisStr}
	return g.Locacoes.Atualizar(ctx, l, mov)
}

// ReclassificarEmLote espelha `reclassificarEmLote` — ver COMPORTAMENTO.md §4.3.
func (g *GerenciadorLocacoes) ReclassificarEmLote(ctx context.Context, ids []string, obraDestinoID string) (int, error) {
	if len(ids) == 0 {
		return 0, erroValidacao("Nenhum item selecionado.")
	}
	destino, err := g.Obras.BuscarPorID(ctx, obraDestinoID)
	if err != nil {
		return 0, err
	}
	if destino == nil {
		return 0, erroValidacao("Obra de destino não encontrada.")
	}
	if err := g.Locacoes.ReclassificarEmLote(ctx, ids, obraDestinoID, destino.Codigo); err != nil {
		return 0, err
	}
	return len(ids), nil
}
