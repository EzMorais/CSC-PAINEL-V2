// Package identidade contém os handlers HTTP do antigo Portal — a camada mais externa,
// que só sabe traduzir requisição/resposta pra chamadas de aplicação. Ver ARQUITETURA.md §1.
package identidade

import (
	aplicacao "siqueiracampos/servidor/internal/application/identidade"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
	tpl "siqueiracampos/servidor/templates/identidade"
)

type Handlers struct {
	Sessoes      *middleware.Sessoes
	Autenticador *aplicacao.Autenticador
	Gerenciador  *aplicacao.GerenciadorUsuarios
	Usuarios     dominio.UsuarioRepositorio
	Registros    dominio.RegistroAcessoRepositorio
	URLModulo    map[dominio.Modulo]string
}

func Novo(
	sessoes *middleware.Sessoes,
	autenticador *aplicacao.Autenticador,
	gerenciador *aplicacao.GerenciadorUsuarios,
	usuarios dominio.UsuarioRepositorio,
	registros dominio.RegistroAcessoRepositorio,
	urlModulo map[dominio.Modulo]string,
) *Handlers {
	return &Handlers{
		Sessoes: sessoes, Autenticador: autenticador, Gerenciador: gerenciador,
		Usuarios: usuarios, Registros: registros, URLModulo: urlModulo,
	}
}

// opcoesCargo e opcoesModulo alimentam os <select>/checkboxes dos templates, na mesma
// ordem de domain/identidade — a ordem importa pra UI, ver COMPORTAMENTO.md §3.
func opcoesCargo() []tpl.OpcaoCargo {
	op := make([]tpl.OpcaoCargo, len(dominio.Cargos))
	for i, c := range dominio.Cargos {
		op[i] = tpl.OpcaoCargo{Valor: string(c), Rotulo: dominio.RotuloCargo[c], Descricao: dominio.DescricaoCargo[c]}
	}
	return op
}

func opcoesModulo() []tpl.OpcaoModulo {
	op := make([]tpl.OpcaoModulo, len(dominio.Modulos))
	for i, m := range dominio.Modulos {
		op[i] = tpl.OpcaoModulo{Valor: string(m), Rotulo: dominio.RotuloModulo[m]}
	}
	return op
}
