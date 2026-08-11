package estoque

import (
	"net/http"
	"net/http/httptest"
	"testing"

	identidade "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
	"siqueiracampos/servidor/internal/services/sessao"
)

func novoSessoesTeste(t *testing.T) *middleware.Sessoes {
	t.Helper()
	servico, err := sessao.NovoServico("segredo-de-teste-com-mais-de-32-caracteres-000")
	if err != nil {
		t.Fatal(err)
	}
	return middleware.NovoSessoes(servico, false)
}

func cookieDe(t *testing.T, s *middleware.Sessoes, sess identidade.Sessao) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	if err := s.Criar(rec, sess); err != nil {
		t.Fatal(err)
	}
	return rec.Result().Cookies()[0]
}

// TestSessao_BloqueiaSemModuloLiberado prova o P0 corrigido em 2026-08-11: uma sessão válida
// mas sem o módulo Almoxarifado liberado no Portal não pode ler nada do módulo. Antes desta
// correção, qualquer sessão válida passava — ver ERP_BRIEFING_MELHORIA.md item 1.
func TestSessao_BloqueiaSemModuloLiberado(t *testing.T) {
	s := novoSessoesTeste(t)
	h := &Handlers{Sessoes: s}
	cookie := cookieDe(t, s, identidade.Sessao{
		ID: "u1", Cargo: identidade.CargoOperacional, Modulos: []identidade.Modulo{identidade.ModuloRH},
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/almoxarifado", nil)
	req.AddCookie(cookie)

	if _, ok := h.sessao(rec, req); ok {
		t.Fatal("esperava bloqueio: sessão não tem ModuloEstoque liberado")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("esperava 403, veio %d", rec.Code)
	}
}

func TestSessao_LiberaComModulo(t *testing.T) {
	s := novoSessoesTeste(t)
	h := &Handlers{Sessoes: s}
	cookie := cookieDe(t, s, identidade.Sessao{
		ID: "u1", Cargo: identidade.CargoOperacional, Modulos: []identidade.Modulo{identidade.ModuloEstoque},
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/almoxarifado", nil)
	req.AddCookie(cookie)

	if _, ok := h.sessao(rec, req); !ok {
		t.Fatalf("esperava liberar: sessão tem ModuloEstoque; status=%d", rec.Code)
	}
}

func TestSessao_AdminSempreLibera(t *testing.T) {
	s := novoSessoesTeste(t)
	h := &Handlers{Sessoes: s}
	cookie := cookieDe(t, s, identidade.Sessao{ID: "u1", Cargo: identidade.CargoAdmin})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/almoxarifado", nil)
	req.AddCookie(cookie)

	if _, ok := h.sessao(rec, req); !ok {
		t.Fatalf("ADMIN deveria acessar qualquer módulo mesmo sem Modulos preenchido; status=%d", rec.Code)
	}
}
