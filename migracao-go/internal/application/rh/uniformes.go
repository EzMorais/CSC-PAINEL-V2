package rh

import (
	"context"
	"strconv"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type GerenciadorUniformes struct {
	Uniformes dominio.EntregaUniformeRepositorio
}

func (g *GerenciadorUniformes) Listar(ctx context.Context) ([]dominio.EntregaUniformeComNome, error) {
	return g.Uniformes.Listar(ctx)
}

type EntradaUniforme struct {
	FuncionarioID, Peca, Tamanho, Motivo, Quantidade, Observacao, Assinatura string
}

func (g *GerenciadorUniformes) Registrar(ctx context.Context, e EntradaUniforme, registradoPor string) error {
	if e.FuncionarioID == "" {
		return erroValidacao("Escolha o funcionário.")
	}
	if e.Tamanho == "" {
		return erroValidacao("Informe o tamanho.")
	}
	qtd := 1
	if e.Quantidade != "" {
		if n, err := strconv.Atoi(e.Quantidade); err == nil && n > 0 {
			qtd = n
		}
	}
	entrega := &dominio.EntregaUniforme{
		Peca: e.Peca, Tamanho: e.Tamanho, Quantidade: qtd, Motivo: e.Motivo, EntregueEm: time.Now().UTC(),
		Observacao: ponteiro(e.Observacao), Assinatura: ponteiro(e.Assinatura), RegistradoPor: ponteiro(registradoPor),
		FuncionarioID: e.FuncionarioID,
	}
	return g.Uniformes.Criar(ctx, entrega)
}
