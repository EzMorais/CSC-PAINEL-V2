package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/services/sessao"
)

func novoSessoesTeste(t *testing.T, forcaHTTPS bool) *Sessoes {
	t.Helper()
	servico, err := sessao.NovoServico("segredo-de-teste-com-mais-de-32-caracteres-000")
	if err != nil {
		t.Fatal(err)
	}
	return NovoSessoes(servico, forcaHTTPS)
}

func cookieDe(t *testing.T, s *Sessoes, sess identidade.Sessao) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	if err := s.Criar(rec, sess); err != nil {
		t.Fatal(err)
	}
	return rec.Result().Cookies()[0]
}

func TestCriar_CookieSecureSoQuandoForcaHTTPS(t *testing.T) {
	semHTTPS := novoSessoesTeste(t, false)
	c := cookieDe(t, semHTTPS, identidade.Sessao{ID: "u1"})
	if c.Secure {
		t.Error("Secure deveria ser false quando ForcaHTTPS=false")
	}

	comHTTPS := novoSessoesTeste(t, true)
	c2 := cookieDe(t, comHTTPS, identidade.Sessao{ID: "u1"})
	if !c2.Secure {
		t.Error("Secure deveria ser true quando ForcaHTTPS=true")
	}
}

func TestExigirSessao_SemCookieRedireciona(t *testing.T) {
	s := novoSessoesTeste(t, false)
	rec := httptest.NewRecorder()
	sess, ok := s.ExigirSessao(rec, httptest.NewRequest(http.MethodGet, "/rh", nil))

	if ok || sess != nil {
		t.Fatal("sem cookie, esperava ok=false e sess=nil")
	}
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/entrar" {
		t.Fatalf("esperava redirect 302 pra /entrar, veio status=%d location=%q", rec.Code, rec.Header().Get("Location"))
	}
}

func TestExigirSessao_ComCookieValidoPassa(t *testing.T) {
	s := novoSessoesTeste(t, false)
	original := identidade.Sessao{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", Cargo: identidade.CargoOperacional}

	req := httptest.NewRequest(http.MethodGet, "/rh", nil)
	req.AddCookie(cookieDe(t, s, original))

	rec := httptest.NewRecorder()
	sess, ok := s.ExigirSessao(rec, req)

	if !ok || sess == nil {
		t.Fatal("com cookie válido, esperava ok=true e sessão não nula")
	}
	if sess.ID != original.ID || sess.Email != original.Email {
		t.Fatalf("sessão devolvida não confere: %+v", sess)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("não deveria escrever nenhuma resposta quando passa, veio status=%d", rec.Code)
	}
}

func TestExigirSessao_CookieAdulteradoRedireciona(t *testing.T) {
	s := novoSessoesTeste(t, false)
	req := httptest.NewRequest(http.MethodGet, "/rh", nil)
	req.AddCookie(&http.Cookie{Name: NomeCookie, Value: "isto-nao-e-um-jwt-valido"})

	rec := httptest.NewRecorder()
	_, ok := s.ExigirSessao(rec, req)
	if ok {
		t.Fatal("cookie adulterado não pode ser aceito como sessão válida")
	}
}

func TestExigirAdmin_BloqueiaCargoNaoAdmin(t *testing.T) {
	s := novoSessoesTeste(t, false)
	req := httptest.NewRequest(http.MethodGet, "/usuarios", nil)
	req.AddCookie(cookieDe(t, s, identidade.Sessao{ID: "u1", Cargo: identidade.CargoOperacional}))

	rec := httptest.NewRecorder()
	sess, ok := s.ExigirAdmin(rec, req)

	if ok || sess != nil {
		t.Fatal("cargo OPERACIONAL não pode passar em ExigirAdmin")
	}
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/" {
		t.Fatalf("esperava redirect 302 pra /, veio status=%d location=%q", rec.Code, rec.Header().Get("Location"))
	}
}

func TestExigirAdmin_PermiteCargoAdmin(t *testing.T) {
	s := novoSessoesTeste(t, false)
	req := httptest.NewRequest(http.MethodGet, "/usuarios", nil)
	req.AddCookie(cookieDe(t, s, identidade.Sessao{ID: "u1", Cargo: identidade.CargoAdmin}))

	rec := httptest.NewRecorder()
	sess, ok := s.ExigirAdmin(rec, req)

	if !ok || sess == nil {
		t.Fatal("cargo ADMIN deveria passar em ExigirAdmin")
	}
}
