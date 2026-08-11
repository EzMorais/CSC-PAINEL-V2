package compras

import (
	"html/template"
	"net/http"
	"strconv"
	"strings"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/compras"
	"siqueiracampos/servidor/internal/domain/cadastro"
	dominio "siqueiracampos/servidor/internal/domain/compras"
	"siqueiracampos/servidor/internal/domain/comum"
	"siqueiracampos/servidor/internal/domain/estoque"
)

var tplProcesso = template.Must(template.New("processo").Funcs(template.FuncMap{"brlCentavos": func(v int64) string { x := float64(v) / 100; return comum.BRL(&x) }, "centavosFloat": func(v float64) int64 { return int64(v*100 + 0.5) }, "data": func(v *time.Time) string {
	if v == nil {
		return ""
	}
	return v.Format("02/01/2006")
}}).Parse(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/estatico/estilo.css"><title>Compras</title></head><body><main class="conteudo"><nav class="abas"><a href="/compras">Pedidos</a><a href="/compras/cotacoes">Cotações</a><a href="/compras/divergencias">Divergências</a><a href="/compras/devolucoes">Devoluções</a><a href="/compras/contratos">Contratos</a><a href="/compras/relatorios">Relatórios</a></nav>
{{if eq .Pagina "cotacoes"}}<h1>Cotações</h1><details><summary class="botao botao-primario">+ Nova cotação</summary><form class="formulario" method="post" action="/compras/cotacoes"><label>Solicitação</label><select name="solicitacaoID">{{range .Solicitacoes}}<option value="{{.ID}}">{{.Numero}}</option>{{end}}</select><label>Prazo</label><input type="date" name="prazoResposta"><label>Fornecedores (mínimo 2)</label>{{range .Fornecedores}}<label><input type="checkbox" name="fornecedorID" value="{{.ID}}"> {{.Nome}}</label>{{end}}<textarea name="observacao" placeholder="Observação"></textarea><button>Criar</button></form></details><table><tbody>{{range .Cotacoes}}<tr><td><a href="/compras/cotacoes/{{.ID}}">{{.Numero}}</a></td><td>{{.Status}}</td><td>{{.SolicitanteNome}}</td></tr>{{end}}</tbody></table>{{end}}
{{if eq .Pagina "cotacao"}}<h1>{{.Cotacao.Numero}}</h1><p>Status: {{.Cotacao.Status}}</p><h2>Mapa comparativo</h2><table><thead><tr><th>Fornecedor</th><th>Itens</th><th>Frete</th><th>Total</th><th>Prazo</th><th>Ação</th></tr></thead><tbody>{{range .Cotacao.Propostas}}<tr><td>{{.FornecedorNome}}</td><td>{{brlCentavos .ValorItensCentavos}}</td><td>{{brlCentavos .FreteCentavos}}</td><td><strong>{{brlCentavos .TotalCentavos}}</strong></td><td>{{.PrazoDias}} dias</td><td>{{if not .Selecionada}}<form method="post" action="/compras/cotacoes/{{$.Cotacao.ID}}/selecionar"><input type="hidden" name="propostaID" value="{{.ID}}"><input name="motivo" placeholder="Justificativa" required><button>Selecionar e criar pedido</button></form>{{else}}Selecionada{{end}}</td></tr>{{end}}</tbody></table><h2>Registrar proposta</h2><form class="formulario" method="post" action="/compras/cotacoes/{{.Cotacao.ID}}/propostas"><select name="fornecedorID">{{range .Cotacao.Fornecedores}}<option value="{{.FornecedorID}}">{{.FornecedorNome}}</option>{{end}}</select>{{range .Solicitacao.Itens}}<fieldset><legend>{{.MaterialNome}}</legend><input type="hidden" name="materialID" value="{{.MaterialID}}"><label>Quantidade</label><input name="quantidade_{{.MaterialID}}" value="{{.Quantidade}}"><label>Valor unitário (centavos)</label><input name="valor_{{.MaterialID}}" required><label>Marca</label><input name="marca_{{.MaterialID}}"></fieldset>{{end}}<label>Frete (centavos)</label><input name="freteCentavos" value="0"><label>Prazo em dias</label><input type="number" name="prazoDias"><label>Previsão</label><input type="date" name="previsaoEntrega"><label>Condição</label><input name="condicaoPagamento"><label>Validade</label><input type="date" name="validade"><button>Registrar proposta</button></form>{{end}}
{{if eq .Pagina "cotacao"}}<h2>Documentos</h2><ul>{{range .Documentos}}<li><a href="{{.Conteudo}}" target="_blank" rel="noopener">{{.Nome}}</a> — {{.Tipo}}</li>{{else}}<li>Nenhum documento.</li>{{end}}</ul><form method="post" action="/compras/cotacoes/{{.Cotacao.ID}}/documentos"><select name="tipo"><option>PROPOSTA</option><option>OUTRO</option></select><input name="nome" placeholder="Nome" required><input name="conteudo" type="url" placeholder="URL segura do arquivo" required><button>Anexar referência</button></form>{{end}}
{{if eq .Pagina "divergencias"}}<h1>Divergências</h1><table><thead><tr><th>Tipo</th><th>Esperado</th><th>Encontrado</th><th>Status</th><th>Decisão</th></tr></thead><tbody>{{range .Divergencias}}<tr><td>{{.Tipo}}</td><td>{{.Esperado}}</td><td>{{.Encontrado}}</td><td>{{.Status}}</td><td>{{if eq .Status "PENDENTE"}}<form method="post" action="/compras/divergencias/{{.ID}}/resolver"><input name="justificativa" required><button name="decisao" value="ACEITA">Aceitar</button><button name="decisao" value="RECUSADA">Recusar</button></form>{{end}}</td></tr>{{end}}</tbody></table>{{end}}
{{if eq .Pagina "devolucoes"}}<h1>Devoluções ao fornecedor</h1>{{range .OpcoesDevolucao}}<details><summary>Nova devolução do recebimento {{.Recebimento.Numero}} — {{.Pedido.FornecedorNome}}</summary><form method="post" action="/compras/devolucoes"><input type="hidden" name="recebimentoID" value="{{.Recebimento.ID}}"><input type="hidden" name="fornecedorID" value="{{.Pedido.FornecedorID}}"><input name="motivo" placeholder="Motivo" required>{{range .Recebimento.Itens}}<fieldset><input type="hidden" name="materialID" value="{{.MaterialID}}"><label>Material {{.MaterialID}} — quantidade (máx. {{.Quantidade}})</label><input name="quantidade_{{.MaterialID}}"><input type="hidden" name="valor_{{.MaterialID}}" value="{{centavosFloat .ValorUnitario}}"></fieldset>{{end}}<button>Registrar e baixar do estoque</button></form></details>{{end}}<table><thead><tr><th>Número</th><th>Recebimento</th><th>Motivo</th><th>Status</th></tr></thead><tbody>{{range .Devolucoes}}<tr><td>{{.Numero}}</td><td>{{.RecebimentoID}}</td><td>{{.Motivo}}</td><td>{{.Status}}</td></tr>{{end}}</tbody></table>{{end}}
{{if eq .Pagina "contratos"}}<h1>Contratos</h1><details><summary class="botao botao-primario">+ Contrato</summary><form class="formulario" method="post" action="/compras/contratos"><input name="numero" placeholder="Número" required><select name="fornecedorID">{{range .Fornecedores}}<option value="{{.ID}}" data-nome="{{.Nome}}">{{.Nome}}</option>{{end}}</select><input name="fornecedorNome" placeholder="Nome do fornecedor" required><input name="objeto" placeholder="Objeto" required><input type="date" name="inicio" required><input type="date" name="fim"><input name="valorLimiteCentavos" placeholder="Limite em centavos"><select name="periodicidade"><option>UNICA</option><option>SEMANAL</option><option>MENSAL</option><option>TRIMESTRAL</option><option>ANUAL</option></select><input type="date" name="proximaGeracao"><input name="condicaoPagamento" placeholder="Condição"><button>Criar</button></form></details><table><tbody>{{range .Contratos}}<tr><td>{{.Numero}}</td><td>{{.FornecedorNome}}</td><td>{{.Objeto}}</td><td>{{data .Fim}}</td><td>{{.Periodicidade}}</td></tr>{{end}}</tbody></table>{{end}}
{{if eq .Pagina "relatorios"}}<h1>Indicadores de Compras</h1><div class="grade-kpis"><div class="bloco"><p>Aprovações pendentes</p><strong>{{.Indicadores.PedidosPendentes}}</strong></div><div class="bloco"><p>Pedidos atrasados</p><strong>{{.Indicadores.PedidosAtrasados}}</strong></div><div class="bloco"><p>Cotações abertas</p><strong>{{.Indicadores.CotacoesAbertas}}</strong></div><div class="bloco"><p>Divergências</p><strong>{{.Indicadores.DivergenciasPendentes}}</strong></div><div class="bloco"><p>Total comprado</p><strong>{{brlCentavos .Indicadores.TotalCompradoCentavos}}</strong></div><div class="bloco"><p>Economia em cotações</p><strong>{{brlCentavos .Indicadores.EconomiaCotacoesCentavos}}</strong></div><div class="bloco"><p>Lead time médio</p><strong>{{printf "%.1f" .Indicadores.LeadTimeMedioDias}} dias</strong></div></div><h2>Desempenho de fornecedores</h2><table><thead><tr><th>Fornecedor</th><th>Avaliações</th><th>Prazo</th><th>Qualidade</th><th>Atendimento</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>{{range .Desempenhos}}<tr><td>{{.FornecedorNome}}</td><td>{{.QuantidadeAvaliacoes}}</td><td>{{printf "%.1f" .MediaPrazo}}</td><td>{{printf "%.1f" .MediaQualidade}}</td><td>{{printf "%.1f" .MediaAtendimento}}</td><td>{{.QuantidadePedidos}}</td><td>{{brlCentavos .TotalCompradoCentavos}}</td></tr>{{end}}</tbody></table>{{end}}</main></body></html>`))

type processoView struct {
	Pagina          string
	Cotacoes        []dominio.Cotacao
	Cotacao         *dominio.Cotacao
	Solicitacoes    []estoque.SolicitacaoCompra
	Solicitacao     *estoque.SolicitacaoCompra
	Fornecedores    []cadastro.Fornecedor
	Divergencias    []dominio.Divergencia
	Contratos       []dominio.Contrato
	Indicadores     dominio.IndicadoresCompras
	Documentos      []dominio.Documento
	Devolucoes      []dominio.Devolucao
	OpcoesDevolucao []opcaoDevolucao
	Desempenhos     []dominio.DesempenhoFornecedor
}

type opcaoDevolucao struct {
	Recebimento dominio.RecebimentoCompra
	Pedido      *dominio.PedidoCompra
}

func (h *Handlers) renderProcesso(w http.ResponseWriter, v processoView) {
	if err := tplProcesso.Execute(w, v); err != nil {
		http.Error(w, "erro interno", 500)
	}
}
func (h *Handlers) Cotacoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	cs, e := h.RepoProcesso.ListarCotacoes(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	res, _ := h.Gerenciador.Resumo(r.Context())
	h.renderProcesso(w, processoView{Pagina: "cotacoes", Cotacoes: cs, Solicitacoes: res.Solicitacoes, Fornecedores: res.Fornecedores})
}
func (h *Handlers) CotacaoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	c, e := h.Processo.CriarCotacao(r.Context(), *s, aplicacao.EntradaCotacao{SolicitacaoID: r.PostFormValue("solicitacaoID"), PrazoResposta: r.PostFormValue("prazoResposta"), Observacao: r.PostFormValue("observacao"), Fornecedores: r.PostForm["fornecedorID"]})
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/cotacoes/"+c.ID, 303)
}
func (h *Handlers) CotacaoDetalhe(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	c, e := h.RepoProcesso.BuscarCotacao(r.Context(), r.PathValue("id"))
	if e != nil || c == nil {
		http.NotFound(w, r)
		return
	}
	s, _ := h.Gerenciador.Solicitacoes.BuscarPorID(r.Context(), c.SolicitacaoID)
	documentos, _ := h.RepoProcesso.ListarDocumentos(r.Context(), "", c.ID)
	h.renderProcesso(w, processoView{Pagina: "cotacao", Cotacao: c, Solicitacao: s, Documentos: documentos})
}
func (h *Handlers) PropostaRegistrar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	c, e := h.RepoProcesso.BuscarCotacao(r.Context(), r.PathValue("id"))
	if e != nil || c == nil {
		http.NotFound(w, r)
		return
	}
	sol, _ := h.Gerenciador.Solicitacoes.BuscarPorID(r.Context(), c.SolicitacaoID)
	var itens []aplicacao.EntradaItemProposta
	for _, i := range sol.Itens {
		itens = append(itens, aplicacao.EntradaItemProposta{MaterialID: i.MaterialID, Quantidade: r.PostFormValue("quantidade_" + i.MaterialID), ValorUnitarioCentavos: r.PostFormValue("valor_" + i.MaterialID), Marca: r.PostFormValue("marca_" + i.MaterialID)})
	}
	_, e = h.Processo.RegistrarProposta(r.Context(), *s, aplicacao.EntradaProposta{CotacaoID: c.ID, FornecedorID: r.PostFormValue("fornecedorID"), FreteCentavos: r.PostFormValue("freteCentavos"), PrazoDias: r.PostFormValue("prazoDias"), PrevisaoEntrega: r.PostFormValue("previsaoEntrega"), CondicaoPagamento: r.PostFormValue("condicaoPagamento"), Validade: r.PostFormValue("validade"), Itens: itens})
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/cotacoes/"+c.ID, 303)
}
func (h *Handlers) PropostaSelecionar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	p, e := h.Processo.SelecionarPropostaECriarPedido(r.Context(), *s, r.PathValue("id"), r.PostFormValue("propostaID"), r.PostFormValue("motivo"))
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+p.ID, 303)
}
func (h *Handlers) pedidoAcao(w http.ResponseWriter, r *http.Request, acao func(*dominio.PedidoCompra) error) {
	p, e := h.RepoPedidos.BuscarPorID(r.Context(), r.PathValue("id"))
	if e != nil || p == nil {
		http.NotFound(w, r)
		return
	}
	if e = acao(p); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+p.ID, 303)
}
func (h *Handlers) PedidoEnviarAprovacao(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error { return h.Processo.EnviarParaAprovacao(r.Context(), *s, p) })
}
func (h *Handlers) PedidoAprovar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error { return h.Processo.Aprovar(r.Context(), *s, p) })
}
func (h *Handlers) PedidoRejeitar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error {
		return h.Processo.Rejeitar(r.Context(), *s, p, r.PostFormValue("motivo"))
	})
}
func (h *Handlers) PedidoEnviar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error { return h.Processo.MarcarEnviado(r.Context(), *s, p) })
}
func (h *Handlers) PedidoCancelar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error {
		return h.Processo.Cancelar(r.Context(), *s, p, r.PostFormValue("motivo"))
	})
}
func (h *Handlers) PedidoEditar(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.exigirLancamento(w, r); !ok {
		return
	}
	h.pedidoAcao(w, r, func(p *dominio.PedidoCompra) error {
		return h.Processo.EditarRascunho(r.Context(), p, r.PostFormValue("fornecedorID"), r.PostFormValue("observacao"), r.PostFormValue("previsaoEntrega"), r.PostFormValue("condicaoPagamento"))
	})
}
func (h *Handlers) PedidoDocumento(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if e := h.Processo.AnexarDocumento(r.Context(), *s, r.PathValue("id"), "", r.PostFormValue("tipo"), r.PostFormValue("nome"), r.PostFormValue("conteudo")); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+r.PathValue("id"), 303)
}
func (h *Handlers) CotacaoDocumento(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if e := h.Processo.AnexarDocumento(r.Context(), *s, "", r.PathValue("id"), r.PostFormValue("tipo"), r.PostFormValue("nome"), r.PostFormValue("conteudo")); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/cotacoes/"+r.PathValue("id"), 303)
}
func (h *Handlers) FornecedorAvaliar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	p, e := h.RepoPedidos.BuscarPorID(r.Context(), r.PathValue("id"))
	if e != nil || p == nil {
		http.NotFound(w, r)
		return
	}
	if p.Status != dominio.StatusPedidoRecebido {
		http.Error(w, "avalie somente pedido recebido", http.StatusBadRequest)
		return
	}
	a, _ := strconv.Atoi(r.PostFormValue("prazo"))
	q, _ := strconv.Atoi(r.PostFormValue("qualidade"))
	at, _ := strconv.Atoi(r.PostFormValue("atendimento"))
	if e = h.Processo.Avaliar(r.Context(), *s, p.FornecedorID, p.ID, a, q, at, r.PostFormValue("observacao")); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/pedidos/"+p.ID, 303)
}
func (h *Handlers) Divergencias(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	ds, e := h.RepoProcesso.ListarDivergencias(r.Context(), "")
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	h.renderProcesso(w, processoView{Pagina: "divergencias", Divergencias: ds})
}
func (h *Handlers) DivergenciaResolver(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	if e := h.Processo.ResolverDivergencia(r.Context(), *s, r.PathValue("id"), r.PostFormValue("decisao"), r.PostFormValue("justificativa")); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/divergencias", 303)
}
func (h *Handlers) Devolucoes(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	devolucoes, e := h.RepoProcesso.ListarDevolucoes(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	recebimentos, e := h.Gerenciador.Recebimentos.Listar(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	opcoes := make([]opcaoDevolucao, 0, len(recebimentos))
	for _, recebimento := range recebimentos {
		pedido, err := h.RepoPedidos.BuscarPorID(r.Context(), recebimento.PedidoID)
		if err == nil && pedido != nil {
			opcoes = append(opcoes, opcaoDevolucao{Recebimento: recebimento, Pedido: pedido})
		}
	}
	h.renderProcesso(w, processoView{Pagina: "devolucoes", Devolucoes: devolucoes, OpcoesDevolucao: opcoes})
}
func (h *Handlers) DevolucaoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	recebimento, e := h.Gerenciador.Recebimentos.BuscarPorID(r.Context(), r.PostFormValue("recebimentoID"))
	if e != nil || recebimento == nil {
		http.Error(w, "recebimento inválido", 400)
		return
	}
	var itens []dominio.ItemDevolucao
	for _, item := range recebimento.Itens {
		texto := strings.ReplaceAll(strings.TrimSpace(r.PostFormValue("quantidade_"+item.MaterialID)), ",", ".")
		quantidade, _ := strconv.ParseFloat(texto, 64)
		if quantidade <= 0 {
			continue
		}
		valor, _ := strconv.ParseInt(r.PostFormValue("valor_"+item.MaterialID), 10, 64)
		itens = append(itens, dominio.ItemDevolucao{MaterialID: item.MaterialID, Quantidade: quantidade, ValorUnitarioCentavos: valor})
	}
	if _, e = h.Processo.CriarDevolucao(r.Context(), *s, recebimento.ID, r.PostFormValue("fornecedorID"), r.PostFormValue("motivo"), itens); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/devolucoes", 303)
}
func (h *Handlers) Contratos(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	cs, e := h.RepoProcesso.ListarContratos(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	res, _ := h.Gerenciador.Resumo(r.Context())
	h.renderProcesso(w, processoView{Pagina: "contratos", Contratos: cs, Fornecedores: res.Fornecedores})
}
func (h *Handlers) ContratoCriar(w http.ResponseWriter, r *http.Request) {
	s, ok := h.exigirLancamento(w, r)
	if !ok {
		return
	}
	fornecedorID := r.PostFormValue("fornecedorID")
	fornecedorNome := ""
	if res, x := h.Gerenciador.Resumo(r.Context()); x == nil {
		for _, f := range res.Fornecedores {
			if f.ID == fornecedorID {
				fornecedorNome = f.Nome
			}
		}
	}
	_, e := h.Processo.CriarContrato(r.Context(), *s, aplicacao.EntradaContrato{Numero: r.PostFormValue("numero"), FornecedorID: fornecedorID, FornecedorNome: fornecedorNome, Objeto: r.PostFormValue("objeto"), Inicio: r.PostFormValue("inicio"), Fim: r.PostFormValue("fim"), ValorLimiteCentavos: r.PostFormValue("valorLimiteCentavos"), Periodicidade: r.PostFormValue("periodicidade"), ProximaGeracao: r.PostFormValue("proximaGeracao"), CondicaoPagamento: r.PostFormValue("condicaoPagamento")})
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	http.Redirect(w, r, "/compras/contratos", 303)
}
func (h *Handlers) Relatorios(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.Sessoes.ExigirSessao(w, r); !ok {
		return
	}
	i, e := h.RepoProcesso.Indicadores(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	desempenhos, e := h.RepoProcesso.ListarDesempenhoFornecedores(r.Context())
	if e != nil {
		http.Error(w, e.Error(), 500)
		return
	}
	h.renderProcesso(w, processoView{Pagina: "relatorios", Indicadores: i, Desempenhos: desempenhos})
}
