package estoque

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorAprovacoes struct {
	Aprovacoes    dominio.AprovacaoRepositorio
	Materiais     dominio.MaterialRepositorio
	Movimentacoes dominio.MovimentacaoRepositorio
	Solicitacoes  *GerenciadorSolicitacoes
}

type ResultadoAprovar struct{ ReferenciaID *string }

// Aprovar espelha `aprovar(id)` de actions/aprovacoes.ts — revalida tudo de novo no momento
// de decidir, porque entre o pedido e a aprovação o mundo pode ter mudado. Ver
// COMPORTAMENTO.md §4.
func (g *GerenciadorAprovacoes) Aprovar(ctx context.Context, sess identidade.Sessao, id string) (*ResultadoAprovar, error) {
	if !identidade.PodeAprovar(sess.Cargo) {
		return nil, erroValidacao("Só gerência ou diretoria aprova. Seu cargo permite lançar, não aprovar.")
	}

	a, err := g.Aprovacoes.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, erroValidacao("Pedido de aprovação não encontrado.")
	}
	if a.Status != dominio.AprovacaoPendente {
		decisao := "recusado"
		if a.Status == dominio.AprovacaoAprovada {
			decisao = "aprovado"
		}
		return nil, erroValidacao(fmt.Sprintf("Este pedido já foi %s.", decisao))
	}
	// Quem pediu não aprova o próprio pedido, mesmo sendo gerente — é a regra inteira da
	// segregação: sem isto, o gerente lançaria e assinaria sozinho.
	if a.SolicitanteID == sess.ID {
		return nil, erroValidacao("Você fez este pedido — quem aprova tem de ser outra pessoa.")
	}

	var referenciaID *string
	switch a.Tipo {
	case dominio.AprovacaoAjusteInventario:
		var d dominio.DadosAjusteInventario
		if err := json.Unmarshal([]byte(a.Dados), &d); err != nil {
			return nil, err
		}
		material, err := g.Materiais.BuscarPorID(ctx, d.MaterialID)
		if err != nil {
			return nil, err
		}
		if material == nil {
			return nil, erroValidacao("O material deste pedido não existe mais.")
		}
		if !material.Ativo {
			return nil, erroValidacao("O material foi inativado depois do pedido. Reative antes de aprovar.")
		}
		saldo, err := g.Materiais.SaldoDoMaterial(ctx, d.MaterialID)
		if err != nil {
			return nil, err
		}
		diferenca := d.QuantidadeContada - saldo
		if diferenca == 0 {
			return nil, erroValidacao("O saldo mudou desde o pedido e agora bate com a contagem — nada a ajustar. Recuse o pedido.")
		}
		tipo := dominio.MovAjustePositivo
		if diferenca < 0 {
			tipo = dominio.MovAjusteNegativo
		}
		observacao := fmt.Sprintf("Inventário: contado %s, sistema apontava %s.", formatarNumero(d.QuantidadeContada), formatarNumero(saldo))
		if d.Observacao != nil {
			observacao += " " + *d.Observacao
		}
		registradoPor := fmt.Sprintf("%s (aprovado por %s)", a.SolicitanteNome, sess.Nome)
		mov := &dominio.Movimentacao{
			Tipo: tipo, Quantidade: absFloat(diferenca), OcorridoEm: agora(),
			RegistradoPor: &registradoPor, Observacao: &observacao, MaterialID: d.MaterialID,
		}
		if err := g.Movimentacoes.Criar(ctx, mov); err != nil {
			return nil, err
		}
		referenciaID = &mov.ID

	case dominio.AprovacaoPerda:
		var d dominio.DadosPerda
		if err := json.Unmarshal([]byte(a.Dados), &d); err != nil {
			return nil, err
		}
		material, err := g.Materiais.BuscarPorID(ctx, d.MaterialID)
		if err != nil {
			return nil, err
		}
		if material == nil {
			return nil, erroValidacao("O material deste pedido não existe mais.")
		}
		if !material.Ativo {
			return nil, erroValidacao("O material foi inativado depois do pedido. Reative antes de aprovar.")
		}
		saldo, err := g.Materiais.SaldoDoMaterial(ctx, d.MaterialID)
		if err != nil {
			return nil, err
		}
		if d.Quantidade > saldo {
			return nil, erroValidacao(fmt.Sprintf(
				"O saldo caiu para %s %s desde o pedido, e a baixa é de %s. Recuse e peça um novo pedido com a quantidade certa.",
				formatarNumero(saldo), material.Unidade, formatarNumero(d.Quantidade)))
		}
		ocorridoEm := parseDataISO(d.OcorridoEm[:10])
		if ocorridoEm == nil {
			t := agora()
			ocorridoEm = &t
		}
		registradoPor := fmt.Sprintf("%s (aprovado por %s)", a.SolicitanteNome, sess.Nome)
		mov := &dominio.Movimentacao{
			Tipo: dominio.MovPerda, Quantidade: d.Quantidade, OcorridoEm: *ocorridoEm,
			Documento: d.Documento, Observacao: d.Observacao, MaterialID: d.MaterialID, RegistradoPor: &registradoPor,
		}
		if err := g.Movimentacoes.Criar(ctx, mov); err != nil {
			return nil, err
		}
		referenciaID = &mov.ID

	case dominio.AprovacaoSolicitacaoCompra:
		var d dominio.DadosSolicitacaoCompra
		if err := json.Unmarshal([]byte(a.Dados), &d); err != nil {
			return nil, err
		}
		s, err := g.Solicitacoes.Solicitacoes.BuscarPorID(ctx, d.SolicitacaoID)
		if err != nil {
			return nil, err
		}
		if s == nil {
			return nil, erroValidacao("A solicitação deste pedido não existe mais.")
		}
		// O e-mail só sai agora — mesmo motivo do Next.js (dispatch adiado até a aprovação).
		_, _ = g.Solicitacoes.DispararEmail(ctx, d.SolicitacaoID, "")
		referenciaID = &d.SolicitacaoID

	default:
		return nil, erroValidacao(fmt.Sprintf("Tipo de aprovação desconhecido: %s", a.Tipo))
	}

	if err := g.Aprovacoes.Decidir(ctx, id, dominio.AprovacaoAprovada, sess.ID, sess.Nome, nil, referenciaID); err != nil {
		return nil, err
	}
	return &ResultadoAprovar{ReferenciaID: referenciaID}, nil
}

func (g *GerenciadorAprovacoes) Rejeitar(ctx context.Context, sess identidade.Sessao, id, motivo string) error {
	if !identidade.PodeAprovar(sess.Cargo) {
		return erroValidacao("Só gerência ou diretoria aprova. Seu cargo permite lançar, não aprovar.")
	}
	motivo = strings.TrimSpace(motivo)
	if len(motivo) < 3 {
		return erroValidacao("Diga por que está recusando — sem isso a pessoa refaz o mesmo pedido.")
	}

	a, err := g.Aprovacoes.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if a == nil {
		return erroValidacao("Pedido de aprovação não encontrado.")
	}
	if a.Status != dominio.AprovacaoPendente {
		return erroValidacao("Este pedido já foi decidido.")
	}
	if a.SolicitanteID == sess.ID {
		return erroValidacao("Você fez este pedido — quem decide tem de ser outra pessoa.")
	}
	return g.Aprovacoes.Decidir(ctx, id, dominio.AprovacaoRejeitada, sess.ID, sess.Nome, &motivo, nil)
}

func (g *GerenciadorAprovacoes) Listar(ctx context.Context, status string) ([]dominio.Aprovacao, error) {
	return g.Aprovacoes.Listar(ctx, status)
}

func (g *GerenciadorAprovacoes) ContarPendentes(ctx context.Context) (int, error) {
	return g.Aprovacoes.ContarPendentes(ctx)
}

func absFloat(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
