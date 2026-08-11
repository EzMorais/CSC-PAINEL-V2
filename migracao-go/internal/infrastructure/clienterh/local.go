package clienterh

import (
	"context"

	aplicacaoRH "siqueiracampos/servidor/internal/application/rh"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
)

// Local liga Almoxarifado e RH dentro do binário único. A implementação HTTP continua
// disponível para integrações externas, mas não deve ser usada entre módulos do mesmo
// processo depois da migração do RH.
type Local struct {
	Gerenciador *aplicacaoRH.GerenciadorEpi
}

func (l *Local) EnviarFichaEpi(ctx context.Context, f estoque.FichaEpi) estoque.ResultadoRH {
	if l.Gerenciador == nil {
		return estoque.ResultadoRH{Erro: "RH ainda não inicializado"}
	}
	_, err := l.Gerenciador.Receber(ctx, aplicacaoRH.EntradaFichaEpi{
		MovimentacaoID: f.MovimentacaoID, FuncionarioID: f.FuncionarioID,
		MaterialCodigo: f.MaterialCodigo, MaterialNome: f.MaterialNome, Unidade: f.Unidade,
		Quantidade: f.Quantidade, CA: f.CA, ValidadeCA: f.ValidadeCA, EntregueEm: f.EntregueEm,
	})
	if err == nil {
		return estoque.ResultadoRH{OK: true}
	}
	_, permanente := err.(aplicacaoRH.ErroFuncionarioInexistente)
	return estoque.ResultadoRH{Erro: err.Error(), Permanente: permanente}
}
