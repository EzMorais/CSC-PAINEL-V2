package compras

import (
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/compras"
	"siqueiracampos/servidor/internal/domain/cadastro"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/comum"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
)

type Handlers struct {
	Sessoes     *middleware.Sessoes
	Gerenciador *aplicacao.Gerenciador
	RepoPedidos dominio.PedidoRepositorio
}

func Novo(
	sessoes *middleware.Sessoes,
	gerenciador *aplicacao.Gerenciador,
	repoPedidos dominio.PedidoRepositorio,
) *Handlers {
	return &Handlers{
		Sessoes: sessoes, Gerenciador: gerenciador, RepoPedidos: repoPedidos,
	}
}

func (h *Handlers) exigirLancamento(w http.ResponseWriter, r *http.Request) (*identidade.Sessao, bool) {
	sess, ok := h.Sessoes.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if !identidade.PodeLancar(sess.Cargo) {
		http.Error(w, "Seu cargo permite apenas consultar.", http.StatusForbidden)
		return nil, false
	}
	return sess, true
}

type paginaComprasView struct {
	Resumo       *aplicacao.Resumo
	Pedido       *dominio.PedidoCompra
	Erro         string
	Mensagem     string
	Solicitacoes []estoque.SolicitacaoCompra
	Fornecedores []cadastro.Fornecedor
}

var tplCompras = template.Must(template.New("compras").Funcs(template.FuncMap{
	"brl": func(v float64) string { return comum.BRL(&v) },
	"statusLabel": func(s dominio.StatusPedidoCompra) string {
		if r, ok := dominio.RotuloStatusPedidoCompra[s]; ok {
			return r
		}
		return string(s)
	},
	"dataHora": func(t time.Time) string {
		return t.Format("02/01/2006 15:04")
	},
	"saldo": func(solicitada, recebida float64) float64 { return solicitada - recebida },
	"valorInput": func(v *float64) string {
		if v == nil {
			return ""
		}
		return fmt.Sprintf("%.2f", *v)
	},
}).Parse(`<!doctype html>
<html lang="pt-BR" data-modulo="almoxarifado">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Compras</title>
	<link rel="stylesheet" href="/estatico/estilo.css">
	<style>
		main { max-width: 1280px; margin: 0 auto; padding: 24px; }
		.grade { display: grid; gap: 16px; }
		.grade.kpis { grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); }
		.grade.principal { grid-template-columns: 1.1fr 0.9fr; align-items: start; }
		.bloco { border: 2px solid var(--border); padding: 14px; background: var(--card); box-shadow: var(--tile-shadow); }
		.titulo { text-transform: uppercase; letter-spacing: .08em; font-size: .78rem; color: var(--muted-foreground); margin: 0 0 6px; }
		.valor { font-size: 1.45rem; font-weight: 800; }
		.lista { display: grid; gap: 10px; }
		.linha { border: 1px solid var(--border); padding: 12px; background: var(--card); }
		.linha-topo { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
		.tag { display:inline-block; border:1px solid var(--border); padding: 2px 8px; text-transform: uppercase; font-size: .72rem; letter-spacing: .06em; }
		table { width:100%; border-collapse: collapse; margin-top: 10px; }
		th, td { border-bottom:1px solid var(--border); text-align:left; padding: 8px 6px; vertical-align: top; }
		th { font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted-foreground); }
		.pequeno { font-size: .88rem; color: var(--muted-foreground); }
		.dupla { display:grid; gap:12px; }
		@media (max-width: 1000px) { .grade.principal { grid-template-columns: 1fr; } }
	</style>
</head>
<body>
<main>
	{{if .Mensagem}}<div class="erro" style="border-color:var(--color-success); color:var(--color-success); background:var(--color-success-soft)">{{.Mensagem}}</div>{{end}}
	{{if .Erro}}<div class="erro">{{.Erro}}</div>{{end}}

	<section class="grade kpis">
		<div class="bloco"><p class="titulo">Pedidos pendentes</p><div class="valor">{{len .Resumo.PedidosPendentes}}</div></div>
		<div class="bloco"><p class="titulo">Contas em aberto</p><div class="valor">{{len .Resumo.ContasAbertas}}</div></div>
		<div class="bloco"><p class="titulo">Solicitações elegíveis</p><div class="valor">{{len .Resumo.Solicitacoes}}</div></div>
		<div class="bloco"><p class="titulo">Total aberto</p><div class="valor">{{brl .Resumo.TotalAberto}}</div></div>
	</section>

	<section class="grade principal" style="margin-top:16px">
		<div class="dupla">
			<div class="bloco">
				<h2 class="titulo">Novo pedido de compra</h2>
				<form class="formulario" method="post" action="/compras/pedidos">
					<div class="campo">
						<label>Solicitação de origem</label>
						<select name="solicitacaoID" required>
							<option value="">Selecione</option>
							{{range .Solicitacoes}}<option value="{{.ID}}">{{.Numero}} — {{.Status}}</option>{{end}}
						</select>
					</div>
					<div class="campo">
						<label>Fornecedor</label>
						<select name="fornecedorID" required>
							<option value="">Selecione</option>
							{{range .Fornecedores}}<option value="{{.ID}}">{{.Nome}}</option>{{end}}
						</select>
					</div>
					<div class="campo">
						<label>Observação</label>
						<input type="text" name="observacao" placeholder="Condição, prazo, entrega...">
					</div>
					<button type="submit">Criar pedido</button>
				</form>
			</div>

			<div class="bloco">
				<h2 class="titulo">Pedidos recentes</h2>
				<div class="lista">
					{{range .Resumo.PedidosRecentes}}
					<div class="linha">
						<div class="linha-topo">
							<div>
								<strong>{{.Numero}}</strong> <span class="tag">{{statusLabel .Status}}</span><br>
								<span class="pequeno">{{.FornecedorNome}}</span>
							</div>
							<a class="botao botao-secundario" href="/compras/pedidos/{{.ID}}">Abrir</a>
						</div>
						<div class="pequeno">Criado em {{dataHora .CriadoEm}}</div>
						<div class="pequeno">{{len .Itens}} itens • Recebido: {{brl .TotalRecebido}} / Estimado: {{brl .TotalEstimado}}</div>
					</div>
					{{else}}
					<p class="pequeno">Ainda não há pedidos.</p>
					{{end}}
				</div>
			</div>
		</div>

		<div class="dupla">
			{{if .Pedido}}
			<div class="bloco">
				<h2 class="titulo">Detalhe do pedido {{.Pedido.Numero}}</h2>
				<p><strong>Fornecedor:</strong> {{.Pedido.FornecedorNome}}</p>
				<p><strong>Status:</strong> {{statusLabel .Pedido.Status}}</p>
				<p><strong>Total estimado:</strong> {{brl .Pedido.TotalEstimado}}</p>
				<p><strong>Total recebido:</strong> {{brl .Pedido.TotalRecebido}}</p>
				{{if .Pedido.Observacao}}<p><strong>Obs.:</strong> {{.Pedido.Observacao}}</p>{{end}}
				<table>
					<thead><tr><th>Item</th><th>Qtd.</th><th>Recebida</th><th>Saldo</th></tr></thead>
					<tbody>
					{{range .Pedido.Itens}}
						<tr>
							<td>{{.MaterialCodigo}} — {{.MaterialNome}}</td>
							<td>{{.QuantidadeSolicitada}}</td>
							<td>{{.QuantidadeRecebida}}</td>
							<td>{{saldo .QuantidadeSolicitada .QuantidadeRecebida}}</td>
						</tr>
					{{end}}
					</tbody>
				</table>
			</div>

			<div class="bloco">
				<h2 class="titulo">Registrar recebimento</h2>
				<form class="formulario" method="post" action="/compras/pedidos/{{.Pedido.ID}}/receber">
					<div class="campo"><label>Nota fiscal</label><input type="text" name="notaFiscal"></div>
					<div class="campo"><label>Vencimento</label><input type="date" name="vencimento"></div>
					<div class="campo"><label>Observação</label><input type="text" name="observacao"></div>
					{{range .Pedido.Itens}}
					<div class="bloco" style="margin-bottom:10px">
						<strong>{{.MaterialNome}}</strong>
						<div class="campo"><label>Quantidade recebida</label><input type="text" name="quantidade_{{.ID}}" value="{{saldo .QuantidadeSolicitada .QuantidadeRecebida}}"></div>
						<div class="campo"><label>Valor unitário</label><input type="text" name="valor_{{.ID}}" value="{{valorInput .PrecoUnitario}}"></div>
					</div>
					{{end}}
					<button type="submit">Salvar recebimento</button>
				</form>
			</div>
			{{else}}
			<div class="bloco"><p class="pequeno">Abra um pedido para registrar o recebimento.</p></div>
			{{end}}
		</div>
	</section>
</main>
</body>
</html>`))

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	resumo, err := h.Gerenciador.Resumo(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	var pedido *dominio.PedidoCompra
	if id := strings.TrimSpace(r.URL.Query().Get("pedido")); id != "" {
		pedido, _ = h.RepoPedidos.BuscarPorID(ctx, id)
	}
	if pedido == nil && len(resumo.PedidosRecentes) > 0 {
		pedido = &resumo.PedidosRecentes[0]
	}
	if err := tplCompras.Execute(w, paginaComprasView{
		Resumo: resumo, Pedido: pedido,
		Solicitacoes: resumo.Solicitacoes, Fornecedores: resumo.Fornecedores,
	}); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
	}
}

func (h *Handlers) PedidoCriar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "formulário inválido", http.StatusBadRequest)
		return
	}
	pedido, err := h.Gerenciador.CriarPedido(r.Context(), *sess, aplicacao.EntradaPedido{
		SolicitacaoID: r.PostFormValue("solicitacaoID"),
		FornecedorID:  r.PostFormValue("fornecedorID"),
		Observacao:    r.PostFormValue("observacao"),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+pedido.ID, http.StatusSeeOther)
}

func (h *Handlers) PedidoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ctx := r.Context()
	resumo, err := h.Gerenciador.Resumo(ctx)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	pedido, err := h.RepoPedidos.BuscarPorID(ctx, r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if pedido == nil {
		http.NotFound(w, r)
		return
	}
	if err := tplCompras.Execute(w, paginaComprasView{
		Resumo: resumo, Pedido: pedido,
		Solicitacoes: resumo.Solicitacoes, Fornecedores: resumo.Fornecedores,
	}); err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
	}
}

func (h *Handlers) RecebimentoRegistrar(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "formulário inválido", http.StatusBadRequest)
		return
	}
	pedido, err := h.RepoPedidos.BuscarPorID(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	if pedido == nil {
		http.NotFound(w, r)
		return
	}

	itens := make([]aplicacao.ItemRecebimentoEntrada, 0, len(pedido.Itens))
	for _, item := range pedido.Itens {
		qtd := strings.TrimSpace(r.PostFormValue("quantidade_" + item.ID))
		valor := strings.TrimSpace(r.PostFormValue("valor_" + item.ID))
		if qtd == "" {
			continue
		}
		itens = append(itens, aplicacao.ItemRecebimentoEntrada{
			PedidoItemID:  item.ID,
			Quantidade:    qtd,
			ValorUnitario: valor,
		})
	}

	recebimento, err := h.Gerenciador.RegistrarRecebimento(r.Context(), *sess, aplicacao.EntradaRecebimento{
		PedidoID:   pedido.ID,
		NotaFiscal: r.PostFormValue("notaFiscal"),
		Vencimento: r.PostFormValue("vencimento"),
		Observacao: r.PostFormValue("observacao"),
		Itens:      itens,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+recebimento.PedidoID, http.StatusSeeOther)
}
