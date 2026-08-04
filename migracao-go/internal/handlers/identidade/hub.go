package identidade

import (
	"net/http"
	"strings"

	dominio "siqueiracampos/servidor/internal/domain/identidade"
	tpl "siqueiracampos/servidor/templates/identidade"
)

// descricaoModulo espelha SISTEMAS em app/(app)/page.tsx do Portal Next.js original —
// ver COMPORTAMENTO.md (a versão de 5 módulos, antes de Cadastros/Programação).
var descricaoModulo = map[dominio.Modulo]string{
	dominio.ModuloPainel:      "Equipamentos alugados por obra, vencimentos e custo",
	dominio.ModuloRH:          "Funcionários, treinamentos, exames, EPIs e documentos",
	dominio.ModuloEstoque:     "Materiais, entradas e saídas por obra, compras",
	dominio.ModuloAlojamentos: "Moradia dos funcionários, pedidos e programação",
	dominio.ModuloFrota:       "Veículos, manutenções e abastecimento",
}

func (h *Handlers) Hub(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return
	}

	var liberados, bloqueados []tpl.ItemSistema
	for _, m := range dominio.Modulos {
		item := tpl.ItemSistema{
			Modulo: string(m), Rotulo: dominio.RotuloModulo[m],
			Descricao: descricaoModulo[m], URL: h.URLModulo[m],
		}
		if dominio.TemAcesso(*sess, m) {
			liberados = append(liberados, item)
		} else {
			bloqueados = append(bloqueados, item)
		}
	}

	primeiroNome := strings.SplitN(sess.Nome, " ", 2)[0]

	tpl.Hub(
		primeiroNome,
		dominio.RotuloCargo[sess.Cargo],
		dominio.DescricaoCargo[sess.Cargo],
		liberados, bloqueados,
		dominio.PodeLancar(sess.Cargo), dominio.PodeAprovar(sess.Cargo), sess.Cargo == dominio.CargoAdmin,
	).Render(r.Context(), w)
}
