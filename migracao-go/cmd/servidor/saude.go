package main

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

// handlerSaude ("liveness") só confirma que o processo está de pé — sem tocar no banco, pra
// não confundir "processo travado" com "banco fora do ar" (motivos diferentes de reinício).
func handlerSaude() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

// handlerProntidao ("readiness") confirma que o processo consegue falar com o banco — é o
// health check que orquestradores (systemd, Docker, um load balancer) devem usar antes de
// mandar tráfego de verdade pra esta instância.
func handlerProntidao(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancela := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancela()
		if err := db.PingContext(ctx); err != nil {
			http.Error(w, "banco indisponível", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}
