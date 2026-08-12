// Comando servidor sobe o binário único que vai substituir os 5 apps Next.js — hoje os
// módulos de identidade (o antigo Portal, montado na raiz) e Painel de Locação (montado sob
// /painel). Ver migracao-go/README.md.
package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	aplicacaoAlojamentos "siqueiracampos/servidor/internal/application/alojamentos"
	aplicacaoCompras "siqueiracampos/servidor/internal/application/compras"
	aplicacaoEstoque "siqueiracampos/servidor/internal/application/estoque"
	aplicacaoFinanceiro "siqueiracampos/servidor/internal/application/financeiro"
	aplicacaoIdentidade "siqueiracampos/servidor/internal/application/identidade"
	aplicacaoPainel "siqueiracampos/servidor/internal/application/painel"
	aplicacaoRH "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/config"
	dominioIdentidade "siqueiracampos/servidor/internal/domain/identidade"
	dominioPainel "siqueiracampos/servidor/internal/domain/painel"
	"siqueiracampos/servidor/internal/gateway"
	handlersAlojamentos "siqueiracampos/servidor/internal/handlers/alojamentos"
	handlersCompras "siqueiracampos/servidor/internal/handlers/compras"
	handlersEstoque "siqueiracampos/servidor/internal/handlers/estoque"
	handlersFinanceiro "siqueiracampos/servidor/internal/handlers/financeiro"
	handlersIdentidade "siqueiracampos/servidor/internal/handlers/identidade"
	handlersPainel "siqueiracampos/servidor/internal/handlers/painel"
	handlersRH "siqueiracampos/servidor/internal/handlers/rh"
	"siqueiracampos/servidor/internal/infrastructure/clienterh"
	"siqueiracampos/servidor/internal/infrastructure/database"
	"siqueiracampos/servidor/internal/infrastructure/emailenvio"
	"siqueiracampos/servidor/internal/infrastructure/financeirocompras"
	"siqueiracampos/servidor/internal/middleware"
	"siqueiracampos/servidor/internal/services/integracao"
	"siqueiracampos/servidor/internal/services/sessao"
	tplAlojamentos "siqueiracampos/servidor/templates/alojamentos"
)

func main() {
	cfg := config.Carregar()

	db, err := database.Abrir(cfg.CaminhoBanco)
	if err != nil {
		log.Fatalf("abrir banco: %v", err)
	}
	defer db.Close()

	if err := database.AplicarMigracoes(db); err != nil {
		log.Fatalf("aplicar migrações: %v", err)
	}

	servicoSessao, err := sessao.NovoServico(cfg.AuthSecret)
	if err != nil {
		log.Fatalf("sessão: %v", err)
	}
	sessoes := middleware.NovoSessoes(servicoSessao, cfg.ForcaHTTPS)

	mux := http.NewServeMux()

	// Os módulos migrados ficam neste processo. Frota, Cadastros e Programação ainda usam
	// Next.js e o WhatsApp é um conector sem tela; todos continuam atrás da mesma porta
	// pública para que o ERP tenha uma única entrada, sem vazar as portas internas para quem
	// usa o sistema.
	proxyFrota, err := gateway.NovoProxy(cfg.FrotaUpstream)
	if err != nil {
		log.Fatalf("proxy da Frota: %v", err)
	}
	proxyCadastros, err := gateway.NovoProxy(cfg.CadastrosUpstream)
	if err != nil {
		log.Fatalf("proxy de Cadastros: %v", err)
	}
	proxyProgramacao, err := gateway.NovoProxy(cfg.ProgramacaoUpstream)
	if err != nil {
		log.Fatalf("proxy da Programação: %v", err)
	}
	proxyWhatsApp, err := gateway.NovoProxy(cfg.WhatsAppUpstream)
	if err != nil {
		log.Fatalf("proxy do WhatsApp: %v", err)
	}
	mux.HandleFunc("/frota", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/frota/veiculos", http.StatusPermanentRedirect)
	})
	mux.Handle("/frota/", proxyFrota)
	mux.Handle("/cadastros", proxyCadastros)
	mux.Handle("/cadastros/", proxyCadastros)
	mux.Handle("/api/integracao/cadastros", proxyCadastros)
	mux.Handle("/_next/", proxyCadastros)
	// O proxy não pode pular a regra de acesso que a implementação Go anterior aplicava.
	// A Programação legada só confere se há uma sessão válida; este invólucro preserva também
	// a autorização por módulo antes de a requisição sair do gateway.
	programacaoProtegida := func(proximo http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sess := sessoes.Ler(r)
			if sess == nil {
				http.Redirect(w, r, "/entrar?destino="+url.QueryEscape(r.URL.RequestURI()), http.StatusFound)
				return
			}
			if !dominioIdentidade.TemAcesso(*sess, dominioIdentidade.ModuloProgramacao) {
				http.Error(w, "Acesso à Programação Diária não liberado.", http.StatusForbidden)
				return
			}
			proximo.ServeHTTP(w, r)
		})
	}
	// A tela de Programação volta a ser a implementação legada, que preserva o quadro
	// completo. A entrada curta abre a data solicitada; as demais URLs do módulo seguem
	// sendo encaminhadas sem alteração, inclusive os assets em /programacao/_next/.
	mux.Handle("GET /programacao", programacaoProtegida(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/programacao/dia/2026-08-13", http.StatusTemporaryRedirect)
	})))
	mux.Handle("/programacao/", programacaoProtegida(proxyProgramacao))
	mux.HandleFunc("/whatsapp", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/whatsapp/saude", http.StatusPermanentRedirect)
	})
	mux.Handle("/whatsapp/", http.StripPrefix("/whatsapp", proxyWhatsApp))

	// ── Identidade (antigo Portal) — montado na raiz ──────────────────────────
	usuarios := database.NovoUsuarioRepositorio(db)
	registros := database.NovoRegistroAcessoRepositorio(db)
	hIdentidade := handlersIdentidade.Novo(
		sessoes,
		&aplicacaoIdentidade.Autenticador{Usuarios: usuarios, Registros: registros},
		&aplicacaoIdentidade.GerenciadorUsuarios{Usuarios: usuarios},
		usuarios, registros,
		map[dominioIdentidade.Modulo]string{
			dominioIdentidade.ModuloPainel:      "/painel",
			dominioIdentidade.ModuloRH:          "/rh",
			dominioIdentidade.ModuloEstoque:     "/almoxarifado",
			dominioIdentidade.ModuloAlojamentos: "/alojamentos",
			dominioIdentidade.ModuloFrota:       cfg.URLFrota,
			dominioIdentidade.ModuloFinanceiro:  "/financeiro",
			dominioIdentidade.ModuloProgramacao: "/programacao",
			dominioIdentidade.ModuloCompras:     "/compras",
		},
	)
	mux.HandleFunc("GET /entrar", hIdentidade.Entrar)
	mux.HandleFunc("POST /entrar", hIdentidade.EntrarSubmeter)
	mux.HandleFunc("POST /sair", hIdentidade.Sair)
	mux.HandleFunc("GET /{$}", hIdentidade.Hub)
	mux.HandleFunc("GET /usuarios", hIdentidade.UsuariosListar)
	mux.HandleFunc("POST /usuarios", hIdentidade.UsuariosCriar)
	mux.HandleFunc("POST /usuarios/{id}/editar", hIdentidade.UsuariosEditar)
	mux.HandleFunc("POST /usuarios/{id}/senha", hIdentidade.UsuariosRedefinirSenha)

	// ── Painel de Locação — montado sob /painel ───────────────────────────────
	repoObras := database.NovoObraRepositorio(db)
	repoFornecedores := database.NovoFornecedorRepositorio(db)
	repoLocacoes := database.NovoLocacaoRepositorio(db)
	hPainel := handlersPainel.Novo(
		sessoes,
		&aplicacaoPainel.GerenciadorObras{Obras: repoObras},
		&aplicacaoPainel.GerenciadorFornecedores{Fornecedores: repoFornecedores},
		&aplicacaoPainel.GerenciadorLocacoes{Locacoes: repoLocacoes, Obras: repoObras},
		&aplicacaoPainel.Importador{Obras: repoObras, Fornecedores: repoFornecedores, Locacoes: repoLocacoes},
		repoObras, repoFornecedores, repoLocacoes,
		cfg.PastaUploads,
	)
	mux.HandleFunc("GET /painel", hPainel.Dashboard)
	mux.HandleFunc("GET /painel/locacoes", hPainel.ListarLocacoes)
	mux.HandleFunc("GET /painel/locacoes/nova", hPainel.LocacaoNovaForm)
	mux.HandleFunc("POST /painel/locacoes", hPainel.LocacaoCriar)
	mux.HandleFunc("GET /painel/locacoes/{id}", hPainel.LocacaoDetalhe)
	mux.HandleFunc("POST /painel/locacoes/{id}/renovar", hPainel.LocacaoRenovar)
	mux.HandleFunc("POST /painel/locacoes/{id}/transferir", hPainel.LocacaoTransferir)
	mux.HandleFunc("POST /painel/locacoes/{id}/devolver", hPainel.LocacaoDevolver)
	mux.HandleFunc("GET /painel/obras", hPainel.ListarObras)
	mux.HandleFunc("POST /painel/obras", hPainel.ObraSalvar)
	mux.HandleFunc("POST /painel/obras/{id}/alternar", hPainel.ObraAlternar)
	mux.HandleFunc("GET /painel/fornecedores", hPainel.ListarFornecedores)
	mux.HandleFunc("POST /painel/fornecedores", hPainel.FornecedorSalvar)
	mux.HandleFunc("POST /painel/fornecedores/{id}/alternar", hPainel.FornecedorAlternar)
	mux.HandleFunc("GET /painel/importar", hPainel.Importar)
	mux.HandleFunc("POST /painel/importar/upload", hPainel.ImportarUpload)
	mux.HandleFunc("POST /painel/importar/confirmar", hPainel.ImportarConfirmar)
	mux.HandleFunc("GET /painel/export/xlsx", hPainel.ExportarXLSX)
	mux.HandleFunc("GET /painel/export/pdf", hPainel.ExportarPDF)

	// ── Almoxarifado (Estoque) — montado sob /almoxarifado ────────────────────
	servicoIntegracao, err := integracao.NovoServico(cfg.AuthSecret)
	if err != nil {
		log.Fatalf("integração: %v", err)
	}
	// RH já vive neste processo: a ficha de EPI cruza uma porta Go local. O cliente HTTP
	// permanece no pacote para consumidores/implantações legadas, não para tráfego interno.
	clienteRH := &clienterh.Local{}
	remetenteEmail := emailenvio.NovoAdaptador()

	repoMateriais := database.NovoEstoqueMaterialRepositorio(db)
	repoMovimentacoes := database.NovoEstoqueMovimentacaoRepositorio(db)
	repoSolicitacoes := database.NovoEstoqueSolicitacaoRepositorio(db)
	repoAprovacoes := database.NovoEstoqueAprovacaoRepositorio(db)
	repoConfiguracaoEmail := database.NovoEstoqueConfiguracaoEmailRepositorio(db)
	repoPedidosCompra := database.NovoComprasPedidoRepositorio(db)
	repoRecebimentosCompra := database.NovoComprasRecebimentoRepositorio(db)
	repoContasPagar := database.NovoContasPagarRepositorio(db)
	repoProcessoCompras := database.NovoComprasProcessoRepositorio(db)

	gerenciadorCompras := &aplicacaoCompras.Gerenciador{
		Pedidos: repoPedidosCompra, Recebimentos: repoRecebimentosCompra, Contas: repoContasPagar,
		Fornecedores: repoFornecedores, Solicitacoes: repoSolicitacoes, Materiais: repoMateriais,
		Movimentacoes: repoMovimentacoes,
		Processos:     repoProcessoCompras, Financeiro: financeirocompras.Novo(db),
	}
	gerenciadorProcessoCompras := &aplicacaoCompras.GerenciadorProcesso{Repo: repoProcessoCompras, Pedidos: gerenciadorCompras, Movimentacoes: repoMovimentacoes}
	hCompras := handlersCompras.Novo(sessoes, gerenciadorCompras, gerenciadorProcessoCompras, repoPedidosCompra, repoProcessoCompras)
	repoFinanceiro := database.NovoFinanceiroRepositorio(db)
	gerenciadorFinanceiro := &aplicacaoFinanceiro.GerenciadorOperacional{Repo: repoFinanceiro}
	gerenciadorBaixasFinanceiro := &aplicacaoFinanceiro.GerenciadorBaixas{Repo: repoFinanceiro}
	hFinanceiro := handlersFinanceiro.Novo(sessoes, gerenciadorFinanceiro, gerenciadorBaixasFinanceiro, repoFinanceiro)

	gerenciadorMateriais := &aplicacaoEstoque.GerenciadorMateriais{Materiais: repoMateriais}
	gerenciadorMovimentacoes := &aplicacaoEstoque.GerenciadorMovimentacoes{
		Materiais: repoMateriais, Movimentacoes: repoMovimentacoes, Aprovacoes: repoAprovacoes,
		Configuracao: repoConfiguracaoEmail, ClienteRH: clienteRH,
	}
	gerenciadorSolicitacoes := &aplicacaoEstoque.GerenciadorSolicitacoes{
		Solicitacoes: repoSolicitacoes, Materiais: repoMateriais, Aprovacoes: repoAprovacoes,
		Configuracao: repoConfiguracaoEmail, EmailRemetente: remetenteEmail,
	}
	gerenciadorAprovacoes := &aplicacaoEstoque.GerenciadorAprovacoes{
		Aprovacoes: repoAprovacoes, Materiais: repoMateriais, Movimentacoes: repoMovimentacoes, Solicitacoes: gerenciadorSolicitacoes,
	}
	gerenciadorConfiguracao := &aplicacaoEstoque.GerenciadorConfiguracaoEmail{Configuracao: repoConfiguracaoEmail, EmailRemetente: remetenteEmail}
	gerenciadorDashboardEstoque := &aplicacaoEstoque.GerenciadorDashboard{Materiais: repoMateriais, Movimentacoes: repoMovimentacoes}

	hEstoque := handlersEstoque.Novo(
		sessoes, gerenciadorMateriais, gerenciadorMovimentacoes, gerenciadorSolicitacoes,
		gerenciadorAprovacoes, gerenciadorConfiguracao, gerenciadorDashboardEstoque,
		repoMateriais, repoMovimentacoes, repoSolicitacoes, repoAprovacoes, repoObras, repoFornecedores,
	)
	mux.HandleFunc("GET /almoxarifado", hEstoque.DashboardPagina)
	mux.HandleFunc("GET /almoxarifado/materiais", hEstoque.ListarMateriais)
	mux.HandleFunc("POST /almoxarifado/materiais", hEstoque.MaterialSalvar)
	mux.HandleFunc("GET /almoxarifado/materiais/{id}", hEstoque.MaterialDetalhe)
	mux.HandleFunc("POST /almoxarifado/materiais/{id}/movimentar", hEstoque.MaterialMovimentar)
	mux.HandleFunc("POST /almoxarifado/materiais/{id}/ajustar", hEstoque.MaterialAjustar)
	mux.HandleFunc("POST /almoxarifado/materiais/{id}/alternar", hEstoque.MaterialAlternar)
	mux.HandleFunc("GET /almoxarifado/movimentacoes", hEstoque.ListarMovimentacoes)
	mux.HandleFunc("POST /almoxarifado/movimentacoes/{id}/reenviar-ficha", hEstoque.MovimentacaoReenviarFicha)
	mux.HandleFunc("GET /almoxarifado/solicitacoes", hEstoque.ListarSolicitacoes)
	mux.HandleFunc("GET /almoxarifado/solicitacoes/nova", hEstoque.SolicitacaoNovaForm)
	mux.HandleFunc("POST /almoxarifado/solicitacoes", hEstoque.SolicitacaoCriar)
	mux.HandleFunc("GET /almoxarifado/solicitacoes/{id}", hEstoque.SolicitacaoDetalhe)
	mux.HandleFunc("POST /almoxarifado/solicitacoes/{id}/reenviar-email", hEstoque.SolicitacaoReenviarEmail)
	mux.HandleFunc("POST /almoxarifado/solicitacoes/{id}/status", hEstoque.SolicitacaoStatus)
	mux.HandleFunc("POST /almoxarifado/solicitacoes/{id}/excluir", hEstoque.SolicitacaoExcluir)
	mux.HandleFunc("GET /almoxarifado/aprovacoes", hEstoque.ListarAprovacoes)
	mux.HandleFunc("POST /almoxarifado/aprovacoes/{id}/aprovar", hEstoque.AprovacaoAprovar)
	mux.HandleFunc("POST /almoxarifado/aprovacoes/{id}/rejeitar", hEstoque.AprovacaoRejeitar)
	mux.HandleFunc("GET /almoxarifado/configuracoes", hEstoque.Configuracoes)
	mux.HandleFunc("POST /almoxarifado/configuracoes", hEstoque.ConfiguracoesSalvar)
	mux.HandleFunc("POST /almoxarifado/configuracoes/testar", hEstoque.ConfiguracoesTestar)
	mux.HandleFunc("POST /almoxarifado/configuracoes/desativar", hEstoque.ConfiguracoesDesativar)
	mux.HandleFunc("GET /compras", hCompras.Dashboard)
	mux.HandleFunc("POST /compras/pedidos", hCompras.PedidoCriar)
	mux.HandleFunc("GET /compras/pedidos/{id}", hCompras.PedidoDetalhe)
	mux.HandleFunc("POST /compras/pedidos/{id}/receber", hCompras.RecebimentoRegistrar)
	mux.HandleFunc("POST /compras/pedidos/{id}/enviar-aprovacao", hCompras.PedidoEnviarAprovacao)
	mux.HandleFunc("POST /compras/pedidos/{id}/aprovar", hCompras.PedidoAprovar)
	mux.HandleFunc("POST /compras/pedidos/{id}/rejeitar", hCompras.PedidoRejeitar)
	mux.HandleFunc("POST /compras/pedidos/{id}/enviar", hCompras.PedidoEnviar)
	mux.HandleFunc("POST /compras/pedidos/{id}/cancelar", hCompras.PedidoCancelar)
	mux.HandleFunc("POST /compras/pedidos/{id}/editar", hCompras.PedidoEditar)
	mux.HandleFunc("POST /compras/pedidos/{id}/documentos", hCompras.PedidoDocumento)
	mux.HandleFunc("POST /compras/pedidos/{id}/avaliar", hCompras.FornecedorAvaliar)
	mux.HandleFunc("GET /compras/cotacoes", hCompras.Cotacoes)
	mux.HandleFunc("POST /compras/cotacoes", hCompras.CotacaoCriar)
	mux.HandleFunc("GET /compras/cotacoes/{id}", hCompras.CotacaoDetalhe)
	mux.HandleFunc("POST /compras/cotacoes/{id}/propostas", hCompras.PropostaRegistrar)
	mux.HandleFunc("POST /compras/cotacoes/{id}/selecionar", hCompras.PropostaSelecionar)
	mux.HandleFunc("POST /compras/cotacoes/{id}/documentos", hCompras.CotacaoDocumento)
	mux.HandleFunc("GET /compras/divergencias", hCompras.Divergencias)
	mux.HandleFunc("POST /compras/divergencias/{id}/resolver", hCompras.DivergenciaResolver)
	mux.HandleFunc("GET /compras/devolucoes", hCompras.Devolucoes)
	mux.HandleFunc("POST /compras/devolucoes", hCompras.DevolucaoCriar)
	mux.HandleFunc("GET /compras/contratos", hCompras.Contratos)
	mux.HandleFunc("POST /compras/contratos", hCompras.ContratoCriar)
	mux.HandleFunc("GET /compras/relatorios", hCompras.Relatorios)
	mux.HandleFunc("GET /financeiro", hFinanceiro.Dashboard)
	mux.HandleFunc("POST /financeiro/contas", hFinanceiro.ContaCriar)
	mux.HandleFunc("GET /financeiro/faturamento", hFinanceiro.Faturamentos)
	mux.HandleFunc("POST /financeiro/faturamento", hFinanceiro.FaturamentoCriar)
	mux.HandleFunc("POST /financeiro/faturamento/{id}/faturar", hFinanceiro.Faturar)
	mux.HandleFunc("GET /financeiro/fiscal", hFinanceiro.Fiscal)
	mux.HandleFunc("POST /financeiro/fiscal/importar-sebrae", hFinanceiro.ImportarSebrae)
	mux.HandleFunc("POST /financeiro/fiscal/{id}/resultado", hFinanceiro.FiscalResultado)
	mux.HandleFunc("GET /financeiro/contas-pagar", hFinanceiro.ContasPagar)
	mux.HandleFunc("GET /financeiro/contas-receber", hFinanceiro.ContasReceber)
	mux.HandleFunc("POST /financeiro/titulos", hFinanceiro.TituloCriar)
	mux.HandleFunc("POST /financeiro/titulos/{id}/aprovar", hFinanceiro.TituloAprovar)
	mux.HandleFunc("POST /financeiro/titulos/{id}/baixar", hFinanceiro.TituloBaixar)
	mux.HandleFunc("POST /financeiro/movimentos/{id}/estornar", hFinanceiro.MovimentoEstornar)
	mux.HandleFunc("POST /financeiro/fechamentos", hFinanceiro.FecharCompetencia)
	mux.HandleFunc("POST /financeiro/fechamentos/{competencia}/reabrir", hFinanceiro.ReabrirCompetencia)

	// ── RH e SST — montado sob /rh ─────────────────────────────────────────────
	repoRHCargos := database.NovoRHCargoRepositorio(db)
	repoRHDepartamentos := database.NovoRHDepartamentoRepositorio(db)
	repoRHFuncionarios := database.NovoRHFuncionarioRepositorio(db)
	repoRHDependentes := database.NovoRHDependenteRepositorio(db)
	repoRHEventos := database.NovoRHEventoRepositorio(db)
	repoRHTreinamentos := database.NovoRHTreinamentoRepositorio(db)
	repoRHUniformes := database.NovoRHUniformeRepositorio(db)
	repoRHExames := database.NovoRHExameRepositorio(db)
	repoRHDocumentos := database.NovoRHDocumentoRepositorio(db)
	repoRHAuditorias := database.NovoRHAuditoriaRepositorio(db)
	repoRHNaoConformidades := database.NovoRHNaoConformidadeRepositorio(db)
	repoRHEpi := database.NovoRHEpiRepositorio(db)

	gerenciadorRHFuncionarios := &aplicacaoRH.GerenciadorFuncionarios{
		Funcionarios: repoRHFuncionarios, Cargos: repoRHCargos, Eventos: repoRHEventos,
		ResolverObraCodigo: func(ctx context.Context, obraID string) (string, error) {
			o, err := repoObras.BuscarPorID(ctx, obraID)
			if err != nil || o == nil {
				return "", err
			}
			return o.Codigo, nil
		},
	}
	gerenciadorRHRelatorios := &aplicacaoRH.GerenciadorRelatorios{
		Funcionarios: repoRHFuncionarios, Treinamentos: repoRHTreinamentos, Exames: repoRHExames,
		Auditorias: repoRHAuditorias, NaoConformidades: repoRHNaoConformidades,
	}
	gerenciadorRHImportacao := &aplicacaoRH.GerenciadorImportacao{
		Funcionarios: repoRHFuncionarios, Cargos: repoRHCargos,
		ListarObras: func(ctx context.Context) ([]aplicacaoRH.OpcaoObraImportacao, error) {
			obras, err := repoObras.Listar(ctx)
			if err != nil {
				return nil, err
			}
			opcoes := make([]aplicacaoRH.OpcaoObraImportacao, len(obras))
			for i, o := range obras {
				opcoes[i] = aplicacaoRH.OpcaoObraImportacao{ID: o.ID, Codigo: o.Codigo, Descricao: o.Descricao}
			}
			return opcoes, nil
		},
		CriarObra: func(ctx context.Context, cliente, codigo, descricao string) (string, error) {
			o := &dominioPainel.Obra{Cliente: cliente, Codigo: codigo, Descricao: descricao}
			if err := repoObras.Criar(ctx, o); err != nil {
				return "", err
			}
			return o.ID, nil
		},
	}
	gerenciadorRHEpi := &aplicacaoRH.GerenciadorEpi{Epi: repoRHEpi, Funcionarios: repoRHFuncionarios}
	clienteRH.Gerenciador = gerenciadorRHEpi
	hRH := handlersRH.Novo(handlersRH.Handlers{
		Sessoes:           sessoes,
		Cargos:            &aplicacaoRH.GerenciadorCargos{Cargos: repoRHCargos},
		Departamentos:     &aplicacaoRH.GerenciadorDepartamentos{Departamentos: repoRHDepartamentos},
		Funcionarios:      gerenciadorRHFuncionarios,
		Dashboard:         &aplicacaoRH.GerenciadorDashboard{Funcionarios: repoRHFuncionarios, Eventos: repoRHEventos},
		Treinamentos:      &aplicacaoRH.GerenciadorTreinamentos{Treinamentos: repoRHTreinamentos},
		Uniformes:         &aplicacaoRH.GerenciadorUniformes{Uniformes: repoRHUniformes},
		Exames:            &aplicacaoRH.GerenciadorExames{Exames: repoRHExames},
		Documentos:        &aplicacaoRH.GerenciadorDocumentos{Documentos: repoRHDocumentos},
		Auditorias:        &aplicacaoRH.GerenciadorAuditorias{Auditorias: repoRHAuditorias, NaoConformidades: repoRHNaoConformidades},
		NaoConformidades:  &aplicacaoRH.GerenciadorNaoConformidades{NaoConformidades: repoRHNaoConformidades},
		Epi:               gerenciadorRHEpi,
		Relatorios:        gerenciadorRHRelatorios,
		Importacao:        gerenciadorRHImportacao,
		Integracao:        servicoIntegracao,
		URLEstoque:        cfg.URLEstoque,
		RepoCargos:        repoRHCargos,
		RepoDepartamentos: repoRHDepartamentos,
		RepoFuncionarios:  repoRHFuncionarios,
		RepoDependentes:   repoRHDependentes,
		RepoEventos:       repoRHEventos,
		RepoTreinamentos:  repoRHTreinamentos,
		ContarObrasAtivas: func(ctx context.Context) (int, error) {
			obras, err := repoObras.ListarAtivas(ctx)
			return len(obras), err
		},
		ListarObrasAtivas: func(ctx context.Context) ([]handlersRH.OpcaoObra, error) {
			obras, err := repoObras.ListarAtivas(ctx)
			if err != nil {
				return nil, err
			}
			opcoes := make([]handlersRH.OpcaoObra, len(obras))
			for i, o := range obras {
				opcoes[i] = handlersRH.OpcaoObra{ID: o.ID, Codigo: o.Codigo}
			}
			return opcoes, nil
		},
		ListarObrasFn: func(ctx context.Context) ([]handlersRH.ObraListagem, error) {
			obras, err := repoObras.Listar(ctx)
			if err != nil {
				return nil, err
			}
			lista := make([]handlersRH.ObraListagem, len(obras))
			for i, o := range obras {
				lista[i] = handlersRH.ObraListagem{
					ID: o.ID, Codigo: o.Codigo, Descricao: o.Descricao, Cliente: o.Cliente,
					Responsavel: o.Responsavel, Ativa: o.Ativa,
				}
			}
			return lista, nil
		},
	})
	mux.HandleFunc("GET /rh", hRH.DashboardPagina)
	mux.HandleFunc("GET /rh/funcionarios", hRH.ListarFuncionarios)
	mux.HandleFunc("GET /rh/funcionarios/novo", hRH.FuncionarioNovoForm)
	mux.HandleFunc("POST /rh/funcionarios", hRH.FuncionarioCriar)
	mux.HandleFunc("GET /rh/funcionarios/{id}", hRH.FuncionarioDetalhe)
	mux.HandleFunc("GET /rh/funcionarios/{id}/editar", hRH.FuncionarioEditarForm)
	mux.HandleFunc("POST /rh/funcionarios/{id}", hRH.FuncionarioEditar)
	mux.HandleFunc("POST /rh/funcionarios/{id}/excluir", hRH.FuncionarioExcluir)
	mux.HandleFunc("GET /rh/configuracoes", hRH.Configuracoes)
	mux.HandleFunc("POST /rh/cargos", hRH.CargoCriar)
	mux.HandleFunc("POST /rh/departamentos/ramos", hRH.DepartamentoRamoCriar)
	mux.HandleFunc("POST /rh/departamentos/setores", hRH.DepartamentoSetorCriar)
	mux.HandleFunc("GET /rh/treinamentos", hRH.ListarTreinamentos)
	mux.HandleFunc("GET /rh/treinamentos/{id}", hRH.TreinamentoDetalhe)
	mux.HandleFunc("POST /rh/treinamentos/{id}/participantes", hRH.TreinamentoParticipanteAdicionar)
	mux.HandleFunc("GET /rh/uniformes", hRH.ListarUniformes)
	mux.HandleFunc("POST /rh/uniformes", hRH.UniformeCriar)
	mux.HandleFunc("GET /rh/exames", hRH.ListarExames)
	mux.HandleFunc("POST /rh/exames", hRH.ExameCriar)
	mux.HandleFunc("GET /rh/documentos", hRH.ListarDocumentos)
	mux.HandleFunc("POST /rh/documentos", hRH.DocumentoCriar)
	mux.HandleFunc("GET /rh/documentos/{id}", hRH.DocumentoDetalhe)
	mux.HandleFunc("POST /rh/documentos/{id}/versoes", hRH.DocumentoNovaVersao)
	mux.HandleFunc("GET /rh/auditorias", hRH.ListarAuditorias)
	mux.HandleFunc("POST /rh/auditorias", hRH.AuditoriaCriar)
	mux.HandleFunc("GET /rh/auditorias/{id}", hRH.AuditoriaDetalhe)
	mux.HandleFunc("POST /rh/auditorias/{id}/itens", hRH.AuditoriaItemAdicionar)
	mux.HandleFunc("GET /rh/nao-conformidades", hRH.ListarNaoConformidades)
	mux.HandleFunc("GET /rh/epis", hRH.ListarEpis)
	mux.HandleFunc("GET /rh/obras", hRH.ListarObras)
	mux.HandleFunc("GET /rh/relatorios", hRH.RelatoriosPagina)
	mux.HandleFunc("GET /rh/relatorios/funcionarios.xlsx", hRH.RelatorioFuncionariosXLSX)
	mux.HandleFunc("GET /rh/relatorios/resumo.pdf", hRH.RelatorioResumoPDF)
	mux.HandleFunc("GET /rh/funcionarios/importar", hRH.ImportarFuncionariosPagina)
	mux.HandleFunc("POST /rh/funcionarios/importar/previa", hRH.ImportarFuncionariosPrevia)
	mux.HandleFunc("POST /rh/funcionarios/importar/confirmar", hRH.ImportarFuncionariosConfirmar)
	// Rotas de integração — SEM prefixo /rh, contrato externo com Almoxarifado/Alojamentos/
	// Portal (COMPORTAMENTO.md §6), mesmo padrão de internal/infrastructure/clienterh.
	mux.HandleFunc("POST /api/integracao/entregas-epi", hRH.IntegracaoEntregaEpiCriar)
	mux.HandleFunc("GET /api/integracao/funcionarios", hRH.IntegracaoFuncionariosListar)
	mux.HandleFunc("GET /api/integracao/resumo", hRH.IntegracaoResumo)

	// ── Alojamentos — montado sob /alojamentos ──
	repoAlojamentos := database.NovoAlojamentosRepositorio(db)
	hAlojamentos := &handlersAlojamentos.Handlers{
		Sessoes: sessoes, Repo: repoAlojamentos,
		Whatsapp: repoAlojamentos, Integracao: servicoIntegracao,
		Gerenciador: &aplicacaoAlojamentos.Gerenciador{Repo: repoAlojamentos},
		ListarFuncionarios: func(ctx context.Context) ([]tplAlojamentos.Opcao, error) {
			fs, err := repoRHFuncionarios.ListarAtivosParaIntegracao(ctx)
			if err != nil {
				return nil, err
			}
			opcoes := make([]tplAlojamentos.Opcao, len(fs))
			for i, f := range fs {
				opcoes[i] = tplAlojamentos.Opcao{ID: f.ID, Rotulo: f.Nome, Extra: f.Matricula}
			}
			return opcoes, nil
		},
	}
	mux.HandleFunc("GET /alojamentos", hAlojamentos.Dashboard)
	mux.HandleFunc("GET /alojamentos/cadastros", hAlojamentos.Alojamentos)
	mux.HandleFunc("POST /alojamentos/cadastros", hAlojamentos.AlojamentoCriar)
	mux.HandleFunc("GET /alojamentos/cadastros/{id}", hAlojamentos.AlojamentoDetalhe)
	mux.HandleFunc("POST /alojamentos/cadastros/{id}", hAlojamentos.AlojamentoEditar)
	mux.HandleFunc("POST /alojamentos/cadastros/{id}/alternar", hAlojamentos.AlojamentoAlternar)
	mux.HandleFunc("POST /alojamentos/cadastros/{id}/whatsapp", hAlojamentos.AlojamentoWhatsapp)
	mux.HandleFunc("POST /alojamentos/cadastros/{id}/quartos", hAlojamentos.QuartoCriar)
	mux.HandleFunc("POST /alojamentos/quartos/{id}/alternar", hAlojamentos.QuartoAlternar)
	mux.HandleFunc("GET /alojamentos/moradores", hAlojamentos.Moradores)
	mux.HandleFunc("POST /alojamentos/moradores", hAlojamentos.MoradorCriar)
	mux.HandleFunc("POST /alojamentos/moradores/{id}/encerrar", hAlojamentos.MoradorEncerrar)
	mux.HandleFunc("GET /alojamentos/pedidos", hAlojamentos.Pedidos)
	mux.HandleFunc("POST /alojamentos/pedidos", hAlojamentos.PedidoCriar)
	mux.HandleFunc("POST /alojamentos/pedidos/{id}/status", hAlojamentos.PedidoStatus)
	mux.HandleFunc("GET /alojamentos/programacao", hAlojamentos.Programacao)
	mux.HandleFunc("POST /alojamentos/programacao", hAlojamentos.ProgramacaoCriar)
	mux.HandleFunc("POST /alojamentos/programacao/{id}/excluir", hAlojamentos.ProgramacaoExcluir)
	mux.HandleFunc("GET /alojamentos/rotas", hAlojamentos.Rotas)
	mux.HandleFunc("POST /alojamentos/rotas", hAlojamentos.RotaCriar)
	mux.HandleFunc("POST /alojamentos/rotas/{id}/alternar", hAlojamentos.RotaAlternar)
	mux.HandleFunc("POST /api/integracao/whatsapp/recebida", hAlojamentos.WhatsappRecebida)

	mux.Handle("GET /estatico/", http.StripPrefix("/estatico/", http.FileServer(http.Dir("static"))))

	// /healthz (liveness) e /readyz (readiness) — sem exigir sessão, são consultados por
	// orquestrador/monitoramento, não por gente logada.
	mux.HandleFunc("GET /healthz", handlerSaude())
	mux.HandleFunc("GET /readyz", handlerProntidao(db))

	// Injeta sessão + URLs de navegação cruzada no context.Context de toda requisição — é o
	// que permite templates/layout/base.templ montar a sidebar sem que nenhum handler ou
	// template-folha precise passar esses dados por parâmetro. Ver ARQUITETURA.md e o adendo
	// de layout em DESIGN-SYSTEM.md.
	handler := middleware.Logging(sessoes)(middleware.ComContextoDeRequisicao(sessoes, middleware.Navegacao{
		URLRH:          cfg.URLRH,
		URLAlojamentos: "/alojamentos",
		URLFrota:       cfg.URLFrota,
		URLPortal:      cfg.URLPortal,
	}, mux))

	servidor := &http.Server{
		Addr:         ":" + cfg.Porta,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second, // exportação de relatório grande pode passar dos 10s padrão
	}

	go func() {
		log.Printf("servidor único (identidade + painel + almoxarifado + RH + compras + alojamentos + financeiro; Programação legada via gateway) ouvindo em :%s", cfg.Porta)
		if err := servidor.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("servidor: %v", err)
		}
	}()

	parar := make(chan os.Signal, 1)
	signal.Notify(parar, syscall.SIGINT, syscall.SIGTERM)
	<-parar

	ctx, cancela := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancela()
	if err := servidor.Shutdown(ctx); err != nil {
		log.Printf("desligamento forçado: %v", err)
	}
}
