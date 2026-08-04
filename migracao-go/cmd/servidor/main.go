// Comando servidor sobe o binário único que vai substituir os 5 apps Next.js — hoje só
// o módulo de identidade (o antigo Portal). Ver migracao-go/README.md.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	aplicacao "siqueiracampos/servidor/internal/application/identidade"
	"siqueiracampos/servidor/internal/config"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	handlers "siqueiracampos/servidor/internal/handlers/identidade"
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

	usuarios := database.NovoUsuarioRepositorio(db)
	registros := database.NovoRegistroAcessoRepositorio(db)

	h := handlers.Novo(
		sessoes,
		&aplicacao.Autenticador{Usuarios: usuarios, Registros: registros},
		&aplicacao.GerenciadorUsuarios{Usuarios: usuarios},
		usuarios, registros,
		map[dominio.Modulo]string{
			dominio.ModuloPainel:      cfg.URLPainel,
			dominio.ModuloRH:          cfg.URLRH,
			dominio.ModuloEstoque:     cfg.URLEstoque,
			dominio.ModuloAlojamentos: cfg.URLAlojamentos,
			dominio.ModuloFrota:       cfg.URLFrota,
		},
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /entrar", h.Entrar)
	mux.HandleFunc("POST /entrar", h.EntrarSubmeter)
	mux.HandleFunc("POST /sair", h.Sair)
	mux.HandleFunc("GET /{$}", h.Hub)
	mux.HandleFunc("GET /usuarios", h.UsuariosListar)
	mux.HandleFunc("POST /usuarios", h.UsuariosCriar)
	mux.HandleFunc("POST /usuarios/{id}/editar", h.UsuariosEditar)
	mux.HandleFunc("POST /usuarios/{id}/senha", h.UsuariosRedefinirSenha)
	mux.Handle("GET /estatico/", http.StripPrefix("/estatico/", http.FileServer(http.Dir("static"))))

	servidor := &http.Server{
		Addr:         ":" + cfg.Porta,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("servidor de identidade ouvindo em :%s", cfg.Porta)
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
