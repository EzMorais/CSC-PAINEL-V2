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

	aplicacaoIdentidade "siqueiracampos/servidor/internal/application/identidade"
	aplicacaoPainel "siqueiracampos/servidor/internal/application/painel"
	"siqueiracampos/servidor/internal/config"
	dominioIdentidade "siqueiracampos/servidor/internal/domain/identidade"
	handlersIdentidade "siqueiracampos/servidor/internal/handlers/identidade"
	handlersPainel "siqueiracampos/servidor/internal/handlers/painel"
	"siqueiracampos/servidor/internal/infrastructure/database"
	"siqueiracampos/servidor/internal/middleware"
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

	mux.Handle("GET /estatico/", http.StripPrefix("/estatico/", http.FileServer(http.Dir("static"))))

	servidor := &http.Server{
		Addr:         ":" + cfg.Porta,
		Handler:      mux,
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
