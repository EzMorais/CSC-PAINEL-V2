package database

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/painel"
)

type LocacaoRepositorio struct{ DB *sql.DB }

func NovoLocacaoRepositorio(db *sql.DB) *LocacaoRepositorio { return &LocacaoRepositorio{DB: db} }

const colunasLocacao = `
	l.id, l.descricao, l.tr_codigo, l.quantidade, l.estado, l.observacoes,
	l.data_inicio, l.data_fim, l.valor_item, l.devolvida_em, l.obra_a_confirmar,
	l.possivel_duplicata, l.numero_origem, l.criado_em, l.atualizado_em, l.obra_id, l.fornecedor_id`

func rfc3339(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(time.RFC3339)
}

func parseRFC3339Ptr(s sql.NullString) *time.Time {
	if !s.Valid {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s.String)
	if err != nil {
		return nil
	}
	return &t
}

func lerLocacao(linha linhaEscaneavel) (*painel.Locacao, error) {
	var l painel.Locacao
	var trCodigo, observacoes, numeroOrigem, fornecedorID sql.NullString
	var dataInicio, dataFim, devolvidaEm sql.NullString
	var valorItem sql.NullFloat64
	var obraAConfirmar, possivelDuplicata int
	var criadoEm, atualizadoEm string
	var estado string

	if err := linha.Scan(
		&l.ID, &l.Descricao, &trCodigo, &l.Quantidade, &estado, &observacoes,
		&dataInicio, &dataFim, &valorItem, &devolvidaEm, &obraAConfirmar,
		&possivelDuplicata, &numeroOrigem, &criadoEm, &atualizadoEm, &l.ObraID, &fornecedorID,
	); err != nil {
		return nil, err
	}

	l.Estado = painel.Estado(estado)
	l.ObraAConfirmar = obraAConfirmar != 0
	l.PossivelDuplicata = possivelDuplicata != 0
	l.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	l.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizadoEm)
	l.DataInicio = parseRFC3339Ptr(dataInicio)
	l.DataFim = parseRFC3339Ptr(dataFim)
	l.DevolvidaEm = parseRFC3339Ptr(devolvidaEm)
	if trCodigo.Valid {
		l.TrCodigo = &trCodigo.String
	}
	if observacoes.Valid {
		l.Observacoes = &observacoes.String
	}
	if numeroOrigem.Valid {
		l.NumeroOrigem = &numeroOrigem.String
	}
	if fornecedorID.Valid {
		l.FornecedorID = &fornecedorID.String
	}
	if valorItem.Valid {
		l.ValorItem = &valorItem.Float64
	}
	return &l, nil
}

func (r *LocacaoRepositorio) movimentacoesDe(ctx context.Context, locacaoID string) ([]painel.Movimentacao, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT id, tipo, descricao_humana, payload_antes, payload_depois, criado_em
		FROM movimentacoes_locacao WHERE locacao_id = ? ORDER BY criado_em DESC`, locacaoID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var movs []painel.Movimentacao
	for linhas.Next() {
		var m painel.Movimentacao
		var tipo, criadoEm string
		var antes, depois sql.NullString
		if err := linhas.Scan(&m.ID, &tipo, &m.DescricaoHumana, &antes, &depois, &criadoEm); err != nil {
			return nil, err
		}
		m.Tipo = painel.TipoMovimentacao(tipo)
		m.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
		if antes.Valid {
			m.PayloadAntes = &antes.String
		}
		if depois.Valid {
			m.PayloadDepois = &depois.String
		}
		movs = append(movs, m)
	}
	return movs, linhas.Err()
}

func (r *LocacaoRepositorio) BuscarPorID(ctx context.Context, id string) (*painel.Locacao, error) {
	linha := r.DB.QueryRowContext(ctx, `
		SELECT `+colunasLocacao+`, o.codigo, o.cliente, f.nome
		FROM locacoes l
		JOIN obras o ON o.id = l.obra_id
		LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
		WHERE l.id = ?`, id)

	var l painel.Locacao
	// Reaproveita lerLocacao via um wrapper que também lê as 3 colunas extras não seria
	// direto com a assinatura atual — para BuscarPorID (rota mais lida, drawer de detalhe)
	// os campos de join valem a leitura explícita em vez de uma segunda consulta.
	var trCodigo, observacoes, numeroOrigem, fornecedorID, fornecedorNome sql.NullString
	var dataInicio, dataFim, devolvidaEm sql.NullString
	var valorItem sql.NullFloat64
	var obraAConfirmar, possivelDuplicata int
	var criadoEm, atualizadoEm, estado, obraCodigo, obraCliente string

	err := linha.Scan(
		&l.ID, &l.Descricao, &trCodigo, &l.Quantidade, &estado, &observacoes,
		&dataInicio, &dataFim, &valorItem, &devolvidaEm, &obraAConfirmar,
		&possivelDuplicata, &numeroOrigem, &criadoEm, &atualizadoEm, &l.ObraID, &fornecedorID,
		&obraCodigo, &obraCliente, &fornecedorNome,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	l.Estado = painel.Estado(estado)
	l.ObraAConfirmar = obraAConfirmar != 0
	l.PossivelDuplicata = possivelDuplicata != 0
	l.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	l.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizadoEm)
	l.DataInicio = parseRFC3339Ptr(dataInicio)
	l.DataFim = parseRFC3339Ptr(dataFim)
	l.DevolvidaEm = parseRFC3339Ptr(devolvidaEm)
	l.ObraCodigo, l.ObraCliente = obraCodigo, obraCliente
	if trCodigo.Valid {
		l.TrCodigo = &trCodigo.String
	}
	if observacoes.Valid {
		l.Observacoes = &observacoes.String
	}
	if numeroOrigem.Valid {
		l.NumeroOrigem = &numeroOrigem.String
	}
	if fornecedorID.Valid {
		l.FornecedorID = &fornecedorID.String
	}
	if fornecedorNome.Valid {
		l.FornecedorNome = &fornecedorNome.String
	}
	if valorItem.Valid {
		l.ValorItem = &valorItem.Float64
	}

	movs, err := r.movimentacoesDe(ctx, id)
	if err != nil {
		return nil, err
	}
	l.Movimentacoes = movs
	return &l, nil
}

// clausulaStatus espelha queries/locacoes.ts clausulaStatus — mesmo referencial UTC-meia-
// noite de LimiteEmDias, ver COMPORTAMENTO.md §5.1.
func clausulaStatus(status string, hoje time.Time) (string, []any) {
	inicioHoje := painel.LimiteEmDias(0, hoje).Format(time.RFC3339)
	limiteAtencao := painel.LimiteEmDias(painel.DiasAtencao, hoje).Format(time.RFC3339)

	switch status {
	case string(painel.StatusDevolvida):
		return "l.devolvida_em IS NOT NULL", nil
	case string(painel.StatusVencida):
		return "l.devolvida_em IS NULL AND l.data_fim < ?", []any{inicioHoje}
	case string(painel.StatusAtencao):
		return "l.devolvida_em IS NULL AND l.data_fim >= ? AND l.data_fim <= ?", []any{inicioHoje, limiteAtencao}
	case string(painel.StatusAtiva):
		return "l.devolvida_em IS NULL AND l.data_fim > ?", []any{limiteAtencao}
	case string(painel.StatusSemPrazo):
		return "l.devolvida_em IS NULL AND l.data_fim IS NULL", nil
	case "TODAS":
		return "1 = 1", nil
	default:
		return "l.devolvida_em IS NULL", nil
	}
}

func (r *LocacaoRepositorio) Listar(ctx context.Context, filtros painel.FiltrosLocacao, hoje time.Time) ([]painel.Locacao, error) {
	condicao, args := clausulaStatus(filtros.Status, hoje)
	var onde []string
	onde = append(onde, condicao)

	if filtros.ObraID != "" {
		onde = append(onde, "l.obra_id = ?")
		args = append(args, filtros.ObraID)
	}
	if filtros.FornecedorID != "" {
		onde = append(onde, "l.fornecedor_id = ?")
		args = append(args, filtros.FornecedorID)
	}
	if filtros.Estado != "" {
		onde = append(onde, "l.estado = ?")
		args = append(args, filtros.Estado)
	}
	if filtros.AConfirmar {
		onde = append(onde, "l.obra_a_confirmar = 1")
	}
	if b := strings.TrimSpace(filtros.Busca); b != "" {
		onde = append(onde, `(l.descricao LIKE ? OR l.tr_codigo LIKE ? OR l.observacoes LIKE ? OR l.numero_origem LIKE ?)`)
		curinga := "%" + b + "%"
		args = append(args, curinga, curinga, curinga, curinga)
	}

	consulta := `
		SELECT ` + colunasLocacao + `, o.codigo, o.cliente, f.nome
		FROM locacoes l
		JOIN obras o ON o.id = l.obra_id
		LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
		WHERE ` + strings.Join(onde, " AND ") + `
		ORDER BY (l.data_fim IS NULL) ASC, l.data_fim ASC, l.descricao ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var resultado []painel.Locacao
	for linhas.Next() {
		l, obraCodigo, obraCliente, fornecedorNome, err := escanearLocacaoComObra(linhas)
		if err != nil {
			return nil, err
		}
		l.ObraCodigo, l.ObraCliente, l.FornecedorNome = obraCodigo, obraCliente, fornecedorNome
		resultado = append(resultado, *l)
	}
	return resultado, linhas.Err()
}

// escanearLocacaoComObra é o núcleo comum de Listar/VencimentosProximos/exportação — todas
// juntam obra (INNER) e fornecedor (LEFT).
func escanearLocacaoComObra(linha linhaEscaneavel) (*painel.Locacao, string, string, *string, error) {
	var l painel.Locacao
	var trCodigo, observacoes, numeroOrigem, fornecedorID, fornecedorNome sql.NullString
	var dataInicio, dataFim, devolvidaEm sql.NullString
	var valorItem sql.NullFloat64
	var obraAConfirmar, possivelDuplicata int
	var criadoEm, atualizadoEm, estado, obraCodigo, obraCliente string

	err := linha.Scan(
		&l.ID, &l.Descricao, &trCodigo, &l.Quantidade, &estado, &observacoes,
		&dataInicio, &dataFim, &valorItem, &devolvidaEm, &obraAConfirmar,
		&possivelDuplicata, &numeroOrigem, &criadoEm, &atualizadoEm, &l.ObraID, &fornecedorID,
		&obraCodigo, &obraCliente, &fornecedorNome,
	)
	if err != nil {
		return nil, "", "", nil, err
	}

	l.Estado = painel.Estado(estado)
	l.ObraAConfirmar = obraAConfirmar != 0
	l.PossivelDuplicata = possivelDuplicata != 0
	l.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	l.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizadoEm)
	l.DataInicio = parseRFC3339Ptr(dataInicio)
	l.DataFim = parseRFC3339Ptr(dataFim)
	l.DevolvidaEm = parseRFC3339Ptr(devolvidaEm)
	if trCodigo.Valid {
		l.TrCodigo = &trCodigo.String
	}
	if observacoes.Valid {
		l.Observacoes = &observacoes.String
	}
	if numeroOrigem.Valid {
		l.NumeroOrigem = &numeroOrigem.String
	}
	if fornecedorID.Valid {
		l.FornecedorID = &fornecedorID.String
	}
	if valorItem.Valid {
		l.ValorItem = &valorItem.Float64
	}
	var fn *string
	if fornecedorNome.Valid {
		fn = &fornecedorNome.String
	}
	return &l, obraCodigo, obraCliente, fn, nil
}

func gravarMovimentacao(ctx context.Context, tx *sql.Tx, locacaoID string, mov painel.Movimentacao) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO movimentacoes_locacao (id, tipo, descricao_humana, payload_antes, payload_depois, criado_em, locacao_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), string(mov.Tipo), mov.DescricaoHumana, mov.PayloadAntes, mov.PayloadDepois,
		time.Now().UTC().Format(time.RFC3339), locacaoID)
	return err
}

func (r *LocacaoRepositorio) Criar(ctx context.Context, l *painel.Locacao, mov painel.Movimentacao) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO locacoes (
			id, descricao, tr_codigo, quantidade, estado, observacoes, data_inicio, data_fim,
			valor_item, devolvida_em, obra_a_confirmar, possivel_duplicata, numero_origem,
			criado_em, atualizado_em, obra_id, fornecedor_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, l.Descricao, l.TrCodigo, l.Quantidade, string(l.Estado), l.Observacoes,
		rfc3339(l.DataInicio), rfc3339(l.DataFim), l.ValorItem, rfc3339(l.DevolvidaEm),
		boolParaInt(l.ObraAConfirmar), boolParaInt(l.PossivelDuplicata), l.NumeroOrigem,
		agora, agora, l.ObraID, l.FornecedorID,
	)
	if err != nil {
		return err
	}
	if err := gravarMovimentacao(ctx, tx, id, mov); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	l.ID = id
	return nil
}

func (r *LocacaoRepositorio) Atualizar(ctx context.Context, l *painel.Locacao, mov painel.Movimentacao) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		UPDATE locacoes SET
			descricao = ?, tr_codigo = ?, quantidade = ?, estado = ?, observacoes = ?,
			data_inicio = ?, data_fim = ?, valor_item = ?, devolvida_em = ?,
			obra_a_confirmar = ?, numero_origem = ?, atualizado_em = ?, obra_id = ?, fornecedor_id = ?
		WHERE id = ?`,
		l.Descricao, l.TrCodigo, l.Quantidade, string(l.Estado), l.Observacoes,
		rfc3339(l.DataInicio), rfc3339(l.DataFim), l.ValorItem, rfc3339(l.DevolvidaEm),
		boolParaInt(l.ObraAConfirmar), l.NumeroOrigem, time.Now().UTC().Format(time.RFC3339),
		l.ObraID, l.FornecedorID, l.ID,
	)
	if err != nil {
		return err
	}
	if err := gravarMovimentacao(ctx, tx, l.ID, mov); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *LocacaoRepositorio) ContarPorObra(ctx context.Context, obraID string, somenteEmAberto bool) (int, error) {
	consulta := `SELECT COUNT(*) FROM locacoes WHERE obra_id = ?`
	if somenteEmAberto {
		consulta += ` AND devolvida_em IS NULL`
	}
	var n int
	err := r.DB.QueryRowContext(ctx, consulta, obraID).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) ReclassificarEmLote(ctx context.Context, ids []string, obraDestinoID, obraDestinoCodigo string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	agora := time.Now().UTC().Format(time.RFC3339)
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx,
			`UPDATE locacoes SET obra_id = ?, obra_a_confirmar = 0, atualizado_em = ? WHERE id = ?`,
			obraDestinoID, agora, id,
		); err != nil {
			return err
		}
		mov := painel.Movimentacao{
			Tipo:            painel.MovReclassificacao,
			DescricaoHumana: "Obra confirmada como " + obraDestinoCodigo,
		}
		if err := gravarMovimentacao(ctx, tx, id, mov); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *LocacaoRepositorio) ChavesExistentes(ctx context.Context) (map[string]bool, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT obra_id, descricao, tr_codigo, data_inicio, numero_origem FROM locacoes`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	chaves := map[string]bool{}
	for linhas.Next() {
		var obraID, descricao string
		var trCodigo, numeroOrigem sql.NullString
		var dataInicio sql.NullString
		if err := linhas.Scan(&obraID, &descricao, &trCodigo, &dataInicio, &numeroOrigem); err != nil {
			return nil, err
		}
		var tr, num *string
		if trCodigo.Valid {
			tr = &trCodigo.String
		}
		if numeroOrigem.Valid {
			num = &numeroOrigem.String
		}
		di := parseRFC3339Ptr(dataInicio)
		chaves[painel.ChaveIdempotencia(obraID, descricao, tr, di, num)] = true
	}
	return chaves, linhas.Err()
}

func (r *LocacaoRepositorio) CriarLote(ctx context.Context, itens []painel.ItemImportacao) (int, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	agora := time.Now().UTC().Format(time.RFC3339)
	criadas := 0
	for _, item := range itens {
		id := uuid.NewString()
		_, err := tx.ExecContext(ctx, `
			INSERT INTO locacoes (
				id, descricao, tr_codigo, quantidade, estado, observacoes, data_inicio, data_fim,
				valor_item, devolvida_em, obra_a_confirmar, possivel_duplicata, numero_origem,
				criado_em, atualizado_em, obra_id, fornecedor_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, item.Descricao, item.TrCodigo, item.Quantidade, string(item.Estado), item.Observacoes,
			rfc3339(item.DataInicio), rfc3339(item.DataFim), item.ValorItem, rfc3339(item.DevolvidaEm),
			boolParaInt(item.ObraAConfirmar), boolParaInt(item.PossivelDuplicata), item.NumeroOrigem,
			agora, agora, item.ObraID, item.FornecedorID,
		)
		if err != nil {
			return 0, err
		}
		mov := painel.Movimentacao{
			Tipo:            painel.MovImportacao,
			DescricaoHumana: "Importado da aba " + item.Aba + ", linha " + strconv.Itoa(item.Linha),
		}
		if err := gravarMovimentacao(ctx, tx, id, mov); err != nil {
			return 0, err
		}
		criadas++
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return criadas, nil
}

// ── Dashboard ──────────────────────────────────────────────────────────────

func (r *LocacaoRepositorio) ValorItemDatasNaoDevolvidas(ctx context.Context) ([]painel.ValorEDatas, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT valor_item, data_inicio, data_fim FROM locacoes WHERE devolvida_em IS NULL`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var resultado []painel.ValorEDatas
	for linhas.Next() {
		var valor sql.NullFloat64
		var inicio, fim sql.NullString
		if err := linhas.Scan(&valor, &inicio, &fim); err != nil {
			return nil, err
		}
		v := painel.ValorEDatas{DataInicio: parseRFC3339Ptr(inicio), DataFim: parseRFC3339Ptr(fim)}
		if valor.Valid {
			v.ValorItem = &valor.Float64
		}
		resultado = append(resultado, v)
	}
	return resultado, linhas.Err()
}

func (r *LocacaoRepositorio) ContarNaoDevolvidas(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM locacoes WHERE devolvida_em IS NULL`).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) ContarVencemEmDias(ctx context.Context, ate time.Time, hoje time.Time) (int, error) {
	inicioHoje := painel.LimiteEmDias(0, hoje).Format(time.RFC3339)
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM locacoes WHERE devolvida_em IS NULL AND data_fim >= ? AND data_fim <= ?`,
		inicioHoje, ate.Format(time.RFC3339)).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) ContarVencidas(ctx context.Context, hoje time.Time) (int, error) {
	inicioHoje := painel.LimiteEmDias(0, hoje).Format(time.RFC3339)
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM locacoes WHERE devolvida_em IS NULL AND data_fim < ?`, inicioHoje).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) ContarPorEstado(ctx context.Context, estado painel.Estado, somenteEmAberto bool) (int, error) {
	consulta := `SELECT COUNT(*) FROM locacoes WHERE estado = ?`
	if somenteEmAberto {
		consulta += ` AND devolvida_em IS NULL`
	}
	var n int
	err := r.DB.QueryRowContext(ctx, consulta, string(estado)).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) ContarAConfirmar(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM locacoes WHERE devolvida_em IS NULL AND obra_a_confirmar = 1`).Scan(&n)
	return n, err
}

func (r *LocacaoRepositorio) PorFornecedorNaoDevolvidas(ctx context.Context) ([]painel.LinhaAgregada, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT l.valor_item, l.data_inicio, l.data_fim, f.nome
		FROM locacoes l LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
		WHERE l.devolvida_em IS NULL`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	agregado := map[string]*painel.LinhaAgregada{}
	var ordem []string
	for linhas.Next() {
		var valor sql.NullFloat64
		var inicio, fim, nome sql.NullString
		if err := linhas.Scan(&valor, &inicio, &fim, &nome); err != nil {
			return nil, err
		}
		chave := "Sem fornecedor"
		if nome.Valid {
			chave = nome.String
		}
		var v *float64
		if valor.Valid {
			v = &valor.Float64
		}
		if agregado[chave] == nil {
			agregado[chave] = &painel.LinhaAgregada{Nome: chave}
			ordem = append(ordem, chave)
		}
		agregado[chave].Valor += painel.ValorTotal(v, parseRFC3339Ptr(inicio), parseRFC3339Ptr(fim))
		agregado[chave].Quantidade++
	}
	if err := linhas.Err(); err != nil {
		return nil, err
	}

	resultado := make([]painel.LinhaAgregada, 0, len(ordem))
	for _, k := range ordem {
		resultado = append(resultado, *agregado[k])
	}
	ordenarPorValorDesc(resultado)
	return resultado, nil
}

func (r *LocacaoRepositorio) PorObraNaoDevolvidas(ctx context.Context) ([]painel.LinhaAgregada, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT l.valor_item, l.data_inicio, l.data_fim, o.cliente, o.codigo
		FROM locacoes l JOIN obras o ON o.id = l.obra_id
		WHERE l.devolvida_em IS NULL`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	agregado := map[string]*painel.LinhaAgregada{}
	var ordem []string
	for linhas.Next() {
		var valor sql.NullFloat64
		var inicio, fim sql.NullString
		var cliente, codigo string
		if err := linhas.Scan(&valor, &inicio, &fim, &cliente, &codigo); err != nil {
			return nil, err
		}
		chave := cliente + " · " + codigo
		var v *float64
		if valor.Valid {
			v = &valor.Float64
		}
		if agregado[chave] == nil {
			agregado[chave] = &painel.LinhaAgregada{Nome: chave}
			ordem = append(ordem, chave)
		}
		agregado[chave].Valor += painel.ValorTotal(v, parseRFC3339Ptr(inicio), parseRFC3339Ptr(fim))
		agregado[chave].Quantidade++
	}
	if err := linhas.Err(); err != nil {
		return nil, err
	}

	resultado := make([]painel.LinhaAgregada, 0, len(ordem))
	for _, k := range ordem {
		resultado = append(resultado, *agregado[k])
	}
	ordenarPorValorDesc(resultado)
	return resultado, nil
}

func ordenarPorValorDesc(l []painel.LinhaAgregada) {
	for i := 1; i < len(l); i++ {
		for j := i; j > 0 && l[j].Valor > l[j-1].Valor; j-- {
			l[j], l[j-1] = l[j-1], l[j]
		}
	}
}

func (r *LocacaoRepositorio) VencimentosProximos(ctx context.Context, ate time.Time, limite int) ([]painel.Locacao, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT `+colunasLocacao+`, o.codigo, o.cliente, f.nome
		FROM locacoes l
		JOIN obras o ON o.id = l.obra_id
		LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
		WHERE l.devolvida_em IS NULL AND l.data_fim <= ?
		ORDER BY l.data_fim ASC
		LIMIT ?`, ate.Format(time.RFC3339), limite)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var resultado []painel.Locacao
	for linhas.Next() {
		l, obraCodigo, obraCliente, fornecedorNome, err := escanearLocacaoComObra(linhas)
		if err != nil {
			return nil, err
		}
		l.ObraCodigo, l.ObraCliente, l.FornecedorNome = obraCodigo, obraCliente, fornecedorNome
		resultado = append(resultado, *l)
	}
	return resultado, linhas.Err()
}

// ── Exportação ─────────────────────────────────────────────────────────────

func (r *LocacaoRepositorio) paraExportar(ctx context.Context, somenteObrasAtivas, somenteNaoDevolvidas bool) ([]painel.ObraComLocacoes, error) {
	consultaObras := `SELECT ` + colunasObra + ` FROM obras`
	if somenteObrasAtivas {
		consultaObras += ` WHERE ativa = 1`
	}
	consultaObras += ` ORDER BY cliente ASC, codigo ASC`

	linhasObras, err := r.DB.QueryContext(ctx, consultaObras)
	if err != nil {
		return nil, err
	}
	var obras []painel.Obra
	for linhasObras.Next() {
		o, err := lerObra(linhasObras)
		if err != nil {
			linhasObras.Close()
			return nil, err
		}
		obras = append(obras, *o)
	}
	if err := linhasObras.Err(); err != nil {
		linhasObras.Close()
		return nil, err
	}
	linhasObras.Close()

	resultado := make([]painel.ObraComLocacoes, 0, len(obras))
	for _, o := range obras {
		consulta := `
			SELECT ` + colunasLocacao + `, o.codigo, o.cliente, f.nome
			FROM locacoes l
			JOIN obras o ON o.id = l.obra_id
			LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
			WHERE l.obra_id = ?`
		if somenteNaoDevolvidas {
			consulta += ` AND l.devolvida_em IS NULL`
		}
		consulta += ` ORDER BY (l.devolvida_em IS NULL) DESC, l.data_fim ASC`

		linhas, err := r.DB.QueryContext(ctx, consulta, o.ID)
		if err != nil {
			return nil, err
		}
		var locs []painel.Locacao
		for linhas.Next() {
			l, obraCodigo, obraCliente, fornecedorNome, err := escanearLocacaoComObra(linhas)
			if err != nil {
				linhas.Close()
				return nil, err
			}
			l.ObraCodigo, l.ObraCliente, l.FornecedorNome = obraCodigo, obraCliente, fornecedorNome
			locs = append(locs, *l)
		}
		if err := linhas.Err(); err != nil {
			linhas.Close()
			return nil, err
		}
		linhas.Close()

		resultado = append(resultado, painel.ObraComLocacoes{Obra: o, Locacoes: locs})
	}
	return resultado, nil
}

func (r *LocacaoRepositorio) ParaExportarExcel(ctx context.Context) ([]painel.ObraComLocacoes, error) {
	return r.paraExportar(ctx, false, false)
}

func (r *LocacaoRepositorio) ParaExportarPDF(ctx context.Context) ([]painel.ObraComLocacoes, error) {
	return r.paraExportar(ctx, true, true)
}
