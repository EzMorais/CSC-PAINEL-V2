package estoque

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorMovimentacoes struct {
	Materiais     dominio.MaterialRepositorio
	Movimentacoes dominio.MovimentacaoRepositorio
	Aprovacoes    dominio.AprovacaoRepositorio
	Configuracao  dominio.ConfiguracaoEmailRepositorio
	ClienteRH     dominio.ClienteRH
}

type EntradaMovimentacao struct {
	MaterialID, Tipo                                     string
	Quantidade, ValorUnitario                            string
	ObraID, FornecedorID, FuncionarioID, FuncionarioNome string
	Documento, Observacao, OcorridoEm                    string
}

type ResultadoMovimentacao struct {
	ID                string
	PendenteAprovacao bool
}

// Registrar espelha `registrarMovimentacao` de actions/movimentacoes.ts — a ordem das
// validações importa, ver COMPORTAMENTO.md §5.
func (g *GerenciadorMovimentacoes) Registrar(ctx context.Context, sess identidade.Sessao, e EntradaMovimentacao) (*ResultadoMovimentacao, error) {
	tipo := dominio.TipoMovimentacao(e.Tipo)
	if _, ok := dominio.RotuloMovimentacao[tipo]; !ok {
		return nil, erroValidacao("Tipo de movimentação inválido.")
	}
	materialID := strings.TrimSpace(e.MaterialID)
	if materialID == "" {
		return nil, erroValidacao("Selecione o material.")
	}
	quantidade := parseFloatOpcional(e.Quantidade)
	if quantidade <= 0 {
		return nil, erroValidacao("A quantidade tem de ser maior que zero.")
	}
	ocorridoEm := parseDataISO(e.OcorridoEm)
	if ocorridoEm == nil {
		return nil, erroValidacao("Data inválida.")
	}
	var valorUnitario *float64
	if v := strings.TrimSpace(e.ValorUnitario); v != "" {
		f := parseFloatOpcional(v)
		if f < 0 {
			return nil, erroValidacao("Valor não pode ser negativo.")
		}
		valorUnitario = &f
	}

	material, err := g.Materiais.BuscarPorID(ctx, materialID)
	if err != nil {
		return nil, err
	}
	if material == nil {
		return nil, erroValidacao("Material não encontrado.")
	}
	if !material.Ativo {
		return nil, erroValidacao("Este material está inativo — reative o cadastro antes de movimentar.")
	}

	// Quem é o destino depende da CATEGORIA, não só do tipo: EPI sai para uma pessoa, o
	// resto sai para uma obra — checar a categoria ANTES da obra, senão toda entrega de EPI
	// seria recusada por falta de obra que o formulário nem pede.
	precisaFuncionario := dominio.ExigeFuncionario(tipo, material.Categoria)
	var funcionarioID, funcionarioNome, obraID, fornecedorID *string

	if precisaFuncionario {
		funcionarioID = ponteiro(e.FuncionarioID)
		if funcionarioID == nil {
			return nil, erroValidacao("Saída de EPI precisa do funcionário que recebeu — é a ficha exigida pela NR-6.")
		}
		funcionarioNome = ponteiro(e.FuncionarioNome)
	} else if dominio.ExigeObra[tipo] {
		obraID = ponteiro(e.ObraID)
		if obraID == nil {
			return nil, erroValidacao(fmt.Sprintf("%s precisa da obra de destino.", dominio.RotuloMovimentacao[tipo]))
		}
	}
	if tipo == dominio.MovEntrada {
		fornecedorID = ponteiro(e.FornecedorID)
	}

	// Saída que deixaria o saldo negativo é recusada — não existe no mundo físico, e deixar
	// passar espalha o desencontro por todo relatório daqui pra frente.
	if dominio.SinalMovimentacao[tipo] == -1 {
		saldo, err := g.Materiais.SaldoDoMaterial(ctx, materialID)
		if err != nil {
			return nil, err
		}
		if quantidade > saldo {
			return nil, erroValidacao(fmt.Sprintf(
				"Saldo insuficiente: há %s %s de %q em estoque. Se a quantidade física for outra, lance um ajuste de inventário antes.",
				formatarNumero(saldo), material.Unidade, material.Nome))
		}
	}

	// Perda tira material do saldo sem nada entrando em troca. Acima de NENHUM limite: toda
	// perda lançada por quem não aprova passa pela gerência.
	if tipo == dominio.MovPerda && dominio.PrecisaAprovacao(identidade.PodeAprovar(sess.Cargo), true) {
		dados := dominio.DadosPerda{
			MaterialID: materialID, Quantidade: quantidade, OcorridoEm: ocorridoEm.UTC().Format(time.RFC3339),
			Documento: ponteiro(e.Documento), Observacao: ponteiro(e.Observacao),
		}
		b, err := json.Marshal(dados)
		if err != nil {
			return nil, err
		}
		aprovacao := &dominio.Aprovacao{
			Tipo: dominio.AprovacaoPerda, Dados: string(b),
			Resumo: fmt.Sprintf("%s: baixa de %s %s por perda ou quebra.", material.Nome, formatarNumero(quantidade), material.Unidade),
			Motivo: ponteiro(e.Observacao), SolicitanteID: sess.ID, SolicitanteNome: sess.Nome,
		}
		if err := g.Aprovacoes.Criar(ctx, aprovacao); err != nil {
			return nil, err
		}
		return &ResultadoMovimentacao{PendenteAprovacao: true}, nil
	}

	mov := &dominio.Movimentacao{
		Tipo: tipo, Quantidade: quantidade, ValorUnitario: valorUnitario,
		Documento: ponteiro(e.Documento), Observacao: ponteiro(e.Observacao), OcorridoEm: *ocorridoEm,
		RegistradoPor: ponteiro(sess.Nome), FuncionarioID: funcionarioID, FuncionarioNome: funcionarioNome,
		MaterialID: materialID, ObraID: obraID, FornecedorID: fornecedorID,
	}
	if err := g.Movimentacoes.Criar(ctx, mov); err != nil {
		return nil, err
	}

	// A saída já está gravada. Se o envio da ficha falhar, o material saiu do mesmo jeito —
	// a falha fica registrada na própria movimentação, nunca desfaz o que já aconteceu.
	if precisaFuncionario {
		g.sincronizarFicha(ctx, mov, material)
	}

	return &ResultadoMovimentacao{ID: mov.ID}, nil
}

func (g *GerenciadorMovimentacoes) sincronizarFicha(ctx context.Context, mov *dominio.Movimentacao, material *dominio.Material) {
	var validadeCA *string
	if material.ValidadeCA != nil {
		v := material.ValidadeCA.UTC().Format(time.RFC3339)
		validadeCA = &v
	}
	resultado := g.ClienteRH.EnviarFichaEpi(ctx, dominio.FichaEpi{
		MovimentacaoID: mov.ID, FuncionarioID: *mov.FuncionarioID,
		MaterialCodigo: material.Codigo, MaterialNome: material.Nome, Unidade: material.Unidade,
		Quantidade: mov.Quantidade, CA: material.CA, ValidadeCA: validadeCA,
		EntregueEm: mov.OcorridoEm.UTC().Format(time.RFC3339), EntreguePor: mov.RegistradoPor, Observacao: mov.Observacao,
	})
	if resultado.OK {
		_ = g.Movimentacoes.MarcarSincronizada(ctx, mov.ID, nil)
	} else {
		_ = g.Movimentacoes.MarcarSincronizada(ctx, mov.ID, &resultado.Erro)
	}
}

// SincronizarFicha reenvia (ou envia pela primeira vez) a ficha de uma saída de EPI —
// chamada tanto internamente quanto pelo botão de reenviar na tela. Nunca lança: erro vira
// texto pra tela mostrar, nunca exceção que faria a movimentação parecer que falhou.
func (g *GerenciadorMovimentacoes) SincronizarFicha(ctx context.Context, movimentacaoID string) error {
	mov, err := g.Movimentacoes.BuscarPorID(ctx, movimentacaoID)
	if err != nil {
		return err
	}
	if mov == nil {
		return erroValidacao("Movimentação não encontrada.")
	}
	if mov.FuncionarioID == nil {
		return erroValidacao("Esta movimentação não é uma entrega de EPI.")
	}
	if mov.SincronizadoEm != nil {
		return nil
	}
	material, err := g.Materiais.BuscarPorID(ctx, mov.MaterialID)
	if err != nil {
		return err
	}
	if material == nil {
		return erroValidacao("Material não encontrado.")
	}
	g.sincronizarFicha(ctx, mov, material)
	return nil
}

type EntradaAjuste struct {
	MaterialID, QuantidadeContada, Observacao string
}

type ResultadoAjuste struct {
	Diferenca         float64
	PendenteAprovacao bool
}

// AjustarPorInventario espelha `ajustarPorInventario` — a pessoa digita o que CONTOU, o
// sistema deriva o ajuste (pedir a diferença obrigaria conta de cabeça e escolha de tipo,
// duas chances de errar). Ver COMPORTAMENTO.md §5.
func (g *GerenciadorMovimentacoes) AjustarPorInventario(ctx context.Context, sess identidade.Sessao, e EntradaAjuste) (*ResultadoAjuste, error) {
	materialID := strings.TrimSpace(e.MaterialID)
	if materialID == "" {
		return nil, erroValidacao("Selecione o material.")
	}
	quantidadeContada := parseFloatOpcional(e.QuantidadeContada)
	if quantidadeContada < 0 {
		return nil, erroValidacao("A quantidade contada não pode ser negativa.")
	}

	material, err := g.Materiais.BuscarPorID(ctx, materialID)
	if err != nil {
		return nil, err
	}
	if material == nil {
		return nil, erroValidacao("Material não encontrado.")
	}

	saldo, err := g.Materiais.SaldoDoMaterial(ctx, materialID)
	if err != nil {
		return nil, err
	}
	diferenca := quantidadeContada - saldo
	if diferenca == 0 {
		return nil, erroValidacao("A contagem bate com o saldo do sistema — nada a ajustar.")
	}

	limites, err := obterLimites(ctx, g.Configuracao)
	if err != nil {
		return nil, err
	}
	if dominio.PrecisaAprovacao(identidade.PodeAprovar(sess.Cargo), math.Abs(diferenca) > limites.Ajuste) {
		sinal := "sobra"
		if diferenca < 0 {
			sinal = "falta"
		}
		dados := dominio.DadosAjusteInventario{
			MaterialID: materialID, QuantidadeContada: quantidadeContada, Observacao: ponteiro(e.Observacao),
		}
		b, err := json.Marshal(dados)
		if err != nil {
			return nil, err
		}
		aprovacao := &dominio.Aprovacao{
			Tipo: dominio.AprovacaoAjusteInventario, Dados: string(b),
			Resumo: fmt.Sprintf("%s: contagem de %s %s contra %s no sistema (%s de %s).",
				material.Nome, formatarNumero(quantidadeContada), material.Unidade, formatarNumero(saldo), sinal, formatarNumero(math.Abs(diferenca))),
			Motivo: ponteiro(e.Observacao), SolicitanteID: sess.ID, SolicitanteNome: sess.Nome,
		}
		if err := g.Aprovacoes.Criar(ctx, aprovacao); err != nil {
			return nil, err
		}
		return &ResultadoAjuste{Diferenca: diferenca, PendenteAprovacao: true}, nil
	}

	tipo := dominio.MovAjustePositivo
	if diferenca < 0 {
		tipo = dominio.MovAjusteNegativo
	}
	observacao := fmt.Sprintf("Inventário: contado %s, sistema apontava %s.", formatarNumero(quantidadeContada), formatarNumero(saldo))
	if strings.TrimSpace(e.Observacao) != "" {
		observacao += " " + strings.TrimSpace(e.Observacao)
	}
	mov := &dominio.Movimentacao{
		Tipo: tipo, Quantidade: math.Abs(diferenca), OcorridoEm: time.Now().UTC(),
		RegistradoPor: ponteiro(sess.Nome), Observacao: &observacao, MaterialID: materialID,
	}
	if err := g.Movimentacoes.Criar(ctx, mov); err != nil {
		return nil, err
	}
	return &ResultadoAjuste{Diferenca: diferenca}, nil
}
