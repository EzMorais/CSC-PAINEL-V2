package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"siqueiracampos/servidor/internal/infrastructure/database"
)

func TestHandlerSaude_SempreOK(t *testing.T) {
	rec := httptest.NewRecorder()
	handlerSaude()(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, veio %d", rec.Code)
	}
}

func TestHandlerProntidao_BancoDisponivel(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "prontidao.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	rec := httptest.NewRecorder()
	handlerProntidao(db)(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 com banco disponível, veio %d", rec.Code)
	}
}

func TestHandlerProntidao_BancoIndisponivel(t *testing.T) {
	db, err := database.Abrir(filepath.Join(t.TempDir(), "prontidao.db"))
	if err != nil {
		t.Fatal(err)
	}
	db.Close() // conexão fechada — Ping tem que falhar

	rec := httptest.NewRecorder()
	handlerProntidao(db)(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("esperava 503 com banco indisponível, veio %d", rec.Code)
	}
}
