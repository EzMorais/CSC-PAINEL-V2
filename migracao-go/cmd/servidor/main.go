// Comando servidor sobe o binário único que vai substituir os 5 apps Next.js — hoje os
// módulos de identidade (o antigo Portal, montado na raiz) e Painel de Locação (montado sob
// /painel). Ver migracao-go/README.md.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	aplicacaoEstoque "siqueiracampos/servidor/internal/application/estoque"
	aplicacaoIdentidade "siqueiracampos/servidor/internal/application/identidade"
	aplicacaoPainel "siqueiracampos/servidor/internal/application/painel"
	aplicacaoRH "siqueiracampos/servidor/internal/application/rh"
	"siqueiracampos/servidor/internal/config"
	dominioIdentidade "siqueiracampos/servidor/internal/domain/identidade"
	handlersEstoque "siqueiracampos/servidor/internal/handlers/estoque"
	handlersIdentidade "siqueiracampos/servidor/internal/handlers/identidade"
	handlersPainel "siqueiracampos/servidor/internal/handlers/painel"
	handlersRH "siqueiracampos/servidor/internal/handlers/rh"
	"siqueiracampos/servidor/internal/infrastructure/clienterh"
	"siqueiracampos/servidor/internal/infrastructure/database"
	"siqueiracampos/servidor/internal/infrastructure/emailenvio"
	"siqueiracampos/servidor/internal/middleware"
	"siqueiracampos/servidor/internal/services/integracao"
	"siqueiracampos/servidor/internal/services/sessao"
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
	sessoes := middleware.NovoSessoes(servicoSessao)

	mux := http.NewServeMux()

	// ── Identidade (antigo Portal) — montado na raiz ──────────────────────────
	usuarios := database.NovoUsuarioRepositorio(db)
	registros := database.NovoRegistroAcessoRepositorio(db)
	hIdentidade := handlersIdentidade.Novo(
		sessoes,
		&aplicacaoIdentidade.Autenticador{Usuarios: usuarios, Registros: registros},
		&aplicacaoIdentidade.GerenciadorUsuarios{Usuarios: usuarios},
		usuarios, registros,
		map[dominioIdentidade.Modulo]string{
			dominioIdentidade.ModuloPainel:      cfg.URLPainel,
			dominioIdentidade.ModuloRH:          cfg.URLRH,
			dominioIdentidade.ModuloEstoque:     cfg.URLEstoque,
			dominioIdentidade.ModuloAlojamentos: cfg.URLAlojamentos,
			dominioIdentidade.ModuloFrota:       cfg.URLFrota,
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
	clienteRH := clienterh.Novo(cfg.URLRH, servicoIntegracao)
	remetenteEmail := emailenvio.NovoAdaptador()

	repoMateriais := database.NovoEstoqueMaterialRepositorio(db)
	repoMovimentacoes := database.NovoEstoqueMovimentacaoRepositorio(db)
	repoSolicitacoes := database.NovoEstoqueSolicitacaoRepositorio(db)
	repoAprovacoes := database.NovoEstoqueAprovacaoRepositorio(db)
	repoConfiguracaoEmail := database.NovoEstoqueConfiguracaoEmailRepositorio(db)

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

	// ── RH e SST — montado sob /rh ─────────────────────────────────────────────
	// Primeira fatia: cadastros (Cargo/Departamento) + Funcionário (CRUD, timeline
	// automática, exclusão) + dashboard. Treinamentos/Exames/Uniformes/Documentos/
	// Auditorias/EPI/relatórios/importação ainda não migraram — ver
	// migracao-go/rh/COMPORTAMENTO.md e o README para o que falta.
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
		Epi:               &aplicacaoRH.GerenciadorEpi{Epi: repoRHEpi, Funcionarios: repoRHFuncionarios},
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
	// Rotas de integração — SEM prefixo /rh, contrato externo com Almoxarifado/Alojamentos/
	// Portal (COMPORTAMENTO.md §6), mesmo padrão de internal/infrastructure/clienterh.
	mux.HandleFunc("POST /api/integracao/entregas-epi", hRH.IntegracaoEntregaEpiCriar)
	mux.HandleFunc("GET /api/integracao/funcionarios", hRH.IntegracaoFuncionariosListar)
	mux.HandleFunc("GET /api/integracao/resumo", hRH.IntegracaoResumo)

	mux.Handle("GET /estatico/", http.StripPrefix("/estatico/", http.FileServer(http.Dir("static"))))

	// Injeta sessão + URLs de navegação cruzada no context.Context de toda requisição — é o
	// que permite templates/layout/base.templ montar a sidebar sem que nenhum handler ou
	// template-folha precise passar esses dados por parâmetro. Ver ARQUITETURA.md e o adendo
	// de layout em DESIGN-SYSTEM.md.
	handler := middleware.ComContextoDeRequisicao(sessoes, middleware.Navegacao{
		URLRH:          cfg.URLRH,
		URLAlojamentos: cfg.URLAlojamentos,
	}, mux)

	servidor := &http.Server{
		Addr:         ":" + cfg.Porta,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second, // exportação de relatório grande pode passar dos 10s padrão
	}

	go func() {
		log.Printf("servidor único (identidade + painel) ouvindo em :%s", cfg.Porta)
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
