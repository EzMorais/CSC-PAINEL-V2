package painel

import (
	"context"
	"sort"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/painel"
	"siqueiracampos/servidor/internal/infrastructure/planilha"
)

type Importador struct {
	Obras        dominio.ObraRepositorio
	Fornecedores dominio.FornecedorRepositorio
	Locacoes     dominio.LocacaoRepositorio
}

func (im *Importador) mapaDasObras(ctx context.Context) (dominio.MapaAbas, error) {
	obras, err := im.Obras.Listar(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(obras, func(i, j int) bool { return obras[i].Codigo < obras[j].Codigo })
	return dominio.ConstruirMapaAbas(obras), nil
}

type PorAba struct {
	Aba        string
	Ativos     int
	Devolvidos int
}

type PreviaImportacao struct {
	Total               int
	Ativos              int
	Devolvidos          int
	Perdidos            int
	AConfirmar          int
	PossiveisDuplicatas int
	FornecedoresNovos   []string
	PorAba              []PorAba
	Ignoradas           []dominio.LinhaIgnorada
}

// GerarPrevia espelha `gerarPrevia` — ver COMPORTAMENTO.md §6.7. Só leitura, nunca grava.
func (im *Importador) GerarPrevia(ctx context.Context, caminho string) (*PreviaImportacao, error) {
	mapaAbas, err := im.mapaDasObras(ctx)
	if err != nil {
		return nil, err
	}
	resultado, err := planilha.LerPlanilha(caminho, mapaAbas)
	if err != nil {
		return nil, erroValidacao(err.Error())
	}

	mapaFornecedores, err := im.Fornecedores.MapaPorApelidoOuNome(ctx)
	if err != nil {
		return nil, err
	}

	novos := map[string]bool{}
	porAba := map[string]*PorAba{}
	var ordemAbas []string
	total, ativos, devolvidos, perdidos, aConfirmar, duplicatas := 0, 0, 0, 0, 0, 0

	for _, l := range resultado.Linhas {
		total++
		if l.Devolvida {
			devolvidos++
		} else {
			ativos++
		}
		if l.Estado != nil && *l.Estado == dominio.EstadoPerdido {
			perdidos++
		}
		if l.ObraAConfirmar {
			aConfirmar++
		}
		if l.PossivelDuplicata {
			duplicatas++
		}
		if l.FornecedorBruto != nil {
			norm := dominio.NormalizarTexto(*l.FornecedorBruto)
			if _, ok := mapaFornecedores[norm]; !ok {
				novos[*l.FornecedorBruto] = true
			}
		}
		if porAba[l.Aba] == nil {
			porAba[l.Aba] = &PorAba{Aba: l.Aba}
			ordemAbas = append(ordemAbas, l.Aba)
		}
		if l.Devolvida {
			porAba[l.Aba].Devolvidos++
		} else {
			porAba[l.Aba].Ativos++
		}
	}

	var listaNovos []string
	for n := range novos {
		listaNovos = append(listaNovos, n)
	}
	sort.Strings(listaNovos)

	listaPorAba := make([]PorAba, 0, len(ordemAbas))
	for _, a := range ordemAbas {
		listaPorAba = append(listaPorAba, *porAba[a])
	}

	return &PreviaImportacao{
		Total: total, Ativos: ativos, Devolvidos: devolvidos, Perdidos: perdidos,
		AConfirmar: aConfirmar, PossiveisDuplicatas: duplicatas,
		FornecedoresNovos: listaNovos, PorAba: listaPorAba, Ignoradas: resultado.Ignoradas,
	}, nil
}

type ResultadoImportacao struct {
	Criadas             int
	Puladas             int
	FornecedoresCriados int
}

// ConfirmarImportacao espelha `confirmarImportacao` — ver COMPORTAMENTO.md §6.7.
func (im *Importador) ConfirmarImportacao(ctx context.Context, caminho string) (*ResultadoImportacao, error) {
	mapaAbas, err := im.mapaDasObras(ctx)
	if err != nil {
		return nil, err
	}
	resultado, err := planilha.LerPlanilha(caminho, mapaAbas)
	if err != nil {
		return nil, erroValidacao(err.Error())
	}

	obras, err := im.Obras.Listar(ctx)
	if err != nil {
		return nil, err
	}
	obraPorCodigo := map[string]string{}
	for _, o := range obras {
		obraPorCodigo[o.Codigo] = o.ID
	}

	fornecedoresCriados := 0
	mapaFornecedores, err := im.Fornecedores.MapaPorApelidoOuNome(ctx)
	if err != nil {
		return nil, err
	}
	for _, l := range resultado.Linhas {
		if l.FornecedorBruto == nil {
			continue
		}
		norm := dominio.NormalizarTexto(*l.FornecedorBruto)
		if _, ok := mapaFornecedores[norm]; ok {
			continue
		}
		nome := strings.TrimSpace(*l.FornecedorBruto)
		f := &dominio.Fornecedor{Nome: nome}
		if err := im.Fornecedores.Criar(ctx, f); err != nil {
			return nil, err
		}
		fornecedoresCriados++
		mapaFornecedores[norm] = f.ID
	}

	jaTem, err := im.Locacoes.ChavesExistentes(ctx)
	if err != nil {
		return nil, err
	}

	var itens []dominio.ItemImportacao
	criadas, puladas := 0, 0

	for _, l := range resultado.Linhas {
		obraID, ok := obraPorCodigo[l.ObraCodigo]
		if !ok {
			puladas++
			continue
		}

		chave := dominio.ChaveIdempotencia(obraID, l.Descricao, l.TrCodigo, l.DataInicio, l.NumeroOrigem)
		if jaTem[chave] {
			puladas++
			continue
		}
		jaTem[chave] = true

		var fornecedorID *string
		if l.FornecedorBruto != nil {
			if id, ok := mapaFornecedores[dominio.NormalizarTexto(*l.FornecedorBruto)]; ok {
				fornecedorID = &id
			}
		}

		devolvidaEm := (*time.Time)(nil)
		if l.Devolvida {
			switch {
			case l.DataFim != nil:
				devolvidaEm = l.DataFim
			case l.DataInicio != nil:
				devolvidaEm = l.DataInicio
			default:
				agora := time.Now().UTC()
				devolvidaEm = &agora
			}
		}

		estado := dominio.EstadoOK
		if l.Estado != nil {
			estado = *l.Estado
		}
		quantidade := 1
		if l.Quantidade != nil {
			quantidade = *l.Quantidade
		}

		itens = append(itens, dominio.ItemImportacao{
			Aba: l.Aba, Linha: l.Linha,
			Locacao: dominio.Locacao{
				ObraID: obraID, FornecedorID: fornecedorID, Descricao: l.Descricao,
				TrCodigo: l.TrCodigo, Quantidade: quantidade, Estado: estado,
				Observacoes: l.Observacoes, DataInicio: l.DataInicio, DataFim: l.DataFim,
				ValorItem: l.ValorItem, DevolvidaEm: devolvidaEm,
				ObraAConfirmar: l.ObraAConfirmar, PossivelDuplicata: l.PossivelDuplicata,
				NumeroOrigem: l.NumeroOrigem,
			},
		})
		criadas++
	}

	if len(itens) > 0 {
		if _, err := im.Locacoes.CriarLote(ctx, itens); err != nil {
			return nil, err
		}
	}

	return &ResultadoImportacao{Criadas: criadas, Puladas: puladas, FornecedoresCriados: fornecedoresCriados}, nil
}
