package identidade

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"

	aplicacao "siqueiracampos/servidor/internal/application/identidade"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/middleware"
	"siqueiracampos/servidor/internal/services/sessao"
)

const segredoTeste = "segredo-de-teste-com-mais-de-32-caracteres-000"

type usuariosFake struct{ porEmail map[string]*dominio.Usuario }

func (f *usuariosFake) BuscarPorEmail(ctx context.Context, email string) (*dominio.Usuario, error) {
	if u, ok := f.porEmail[email]; ok {
		return u, nil
	}
	return nil, nil
}
func (f *usuariosFake) BuscarPorID(ctx context.Context, id string) (*dominio.Usuario, error) {
	return nil, nil
}
func (f *usuariosFake) Listar(ctx context.Context) ([]dominio.Usuario, error) { return nil, nil }
func (f *usuariosFake) Criar(ctx context.Context, u *dominio.Usuario, modulos []dominio.Modulo) error {
	return nil
}
func (f *usuariosFake) AtualizarCargoEAcessos(ctx context.Context, id string, cargo dominio.Cargo, ativo bool, modulos []dominio.Modulo) error {
	return nil
}
func (f *usuariosFake) AtualizarSenha(ctx context.Context, id string, senhaHash string) error {
	return nil
}
func (f *usuariosFake) AtualizarUltimoAcesso(ctx context.Context, id string) error { return nil }

type registrosFake struct{ registros []dominio.RegistroAcesso }

func (f *registrosFake) Registrar(ctx context.Context, r dominio.RegistroAcesso) error {
	f.registros = append(f.registros, r)
	return nil
}
func (f *registrosFake) Ultimos(ctx context.Context, limite int) ([]dominio.RegistroAcesso, error) {
	return f.registros, nil
}

func novoHandlers(t *testing.T, usuarios map[string]*dominio.Usuario) (*Handlers, *middleware.Sessoes) {
	t.Helper()
	servico, err := sessao.NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	sessoes := middleware.NovoSessoes(servico, false)
	uf := &usuariosFake{porEmail: usuarios}
	rf := &registrosFake{}
	h := Novo(
		sessoes,
		&aplicacao.Autenticador{Usuarios: uf, Registros: rf},
		nil, uf, rf, nil,
	)
	return h, sessoes
}

func hashDe(t *testing.T, senha string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(senha), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return string(h)
}

func TestEntrar_SemSessaoMostraFormulario(t *testing.T) {
	h, _ := novoHandlers(t, nil)
	rec := httptest.NewRecorder()
	h.Entrar(rec, httptest.NewRequest(http.MethodGet, "/entrar", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, veio %d", rec.Code)
	}
}

func TestEntrar_ComSessaoRedirecionaPraHub(t *testing.T) {
	h, sessoes := novoHandlers(t, nil)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/entrar", nil)

	// Simula sessão já ativa criando o cookie do jeito real (Sessoes.Criar).
	gravador := httptest.NewRecorder()
	if err := sessoes.Criar(gravador, dominio.Sessao{ID: "u1", Email: "ana@exemplo.com.br", Cargo: dominio.CargoAdmin}); err != nil {
		t.Fatal(err)
	}
	req.AddCookie(gravador.Result().Cookies()[0])

	h.Entrar(rec, req)
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/" {
		t.Fatalf("esperava redirect 302 pra /, veio status=%d location=%q", rec.Code, rec.Header().Get("Location"))
	}
}

func formulario(campos map[string]string) *strings.Reader {
	v := url.Values{}
	for k, val := range campos {
		v.Set(k, val)
	}
	return strings.NewReader(v.Encode())
}

func postEntrar(campos map[string]string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/entrar", formulario(campos))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return req
}

func TestEntrarSubmeter_CamposVazios(t *testing.T) {
	h, _ := novoHandlers(t, nil)
	rec := httptest.NewRecorder()
	h.EntrarSubmeter(rec, postEntrar(map[string]string{"email": "", "senha": ""}))

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 (re-renderiza o formulário), veio %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Informe o e-mail e a senha") {
		t.Errorf("esperava mensagem de campo obrigatório no corpo, veio: %s", rec.Body.String())
	}
}

func TestEntrarSubmeter_CredenciaisErradas(t *testing.T) {
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "certa"), Ativo: true}
	h, _ := novoHandlers(t, map[string]*dominio.Usuario{"ana@exemplo.com.br": u})

	rec := httptest.NewRecorder()
	h.EntrarSubmeter(rec, postEntrar(map[string]string{"email": "ana@exemplo.com.br", "senha": "errada"}))

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, veio %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "E-mail ou senha não conferem") {
		t.Errorf("esperava mensagem genérica de erro, veio: %s", rec.Body.String())
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Error("não deveria setar cookie de sessão em login que falhou")
	}
}

func TestEntrarSubmeter_CredenciaisCorretas_SetaCookieERedireciona(t *testing.T) {
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "certa"), Ativo: true, Cargo: dominio.CargoOperacional}
	h, _ := novoHandlers(t, map[string]*dominio.Usuario{"ana@exemplo.com.br": u})

	rec := httptest.NewRecorder()
	h.EntrarSubmeter(rec, postEntrar(map[string]string{"email": "ana@exemplo.com.br", "senha": "certa"}))

	if rec.Code != http.StatusFound {
		t.Fatalf("esperava 302, veio %d — corpo: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Location") != "/" {
		t.Fatalf("sem destino explícito, esperava redirect pra /, veio %q", rec.Header().Get("Location"))
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != middleware.NomeCookie || cookies[0].Value == "" {
		t.Fatalf("esperava cookie de sessão setado, veio %+v", cookies)
	}
}

// TestEntrarSubmeter_DestinoAbertoCaiParaHub prova a proteção contra open redirect
// (COMPORTAMENTO.md §2.2, destinoSeguro em entrar.go): um endereço absoluto ou
// protocolo-relativo no campo `destino` nunca deve ser seguido depois do login.
func TestEntrarSubmeter_DestinoAbertoCaiParaHub(t *testing.T) {
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "certa"), Ativo: true}
	casos := []struct{ destino, esperado string }{
		{"/rh", "/rh"},
		{"http://site-malicioso.com", "/"},
		{"//site-malicioso.com", "/"},
	}
	for _, c := range casos {
		h, _ := novoHandlers(t, map[string]*dominio.Usuario{"ana@exemplo.com.br": u})
		rec := httptest.NewRecorder()
		h.EntrarSubmeter(rec, postEntrar(map[string]string{"email": "ana@exemplo.com.br", "senha": "certa", "destino": c.destino}))

		if got := rec.Header().Get("Location"); got != c.esperado {
			t.Errorf("destino=%q: esperava redirect pra %q, veio %q", c.destino, c.esperado, got)
		}
	}
}

func TestSair_LimpaCookieERedirecionaParaEntrar(t *testing.T) {
	h, _ := novoHandlers(t, nil)
	rec := httptest.NewRecorder()
	h.Sair(rec, httptest.NewRequest(http.MethodPost, "/sair", nil))

	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/entrar" {
		t.Fatalf("esperava redirect 302 pra /entrar, veio status=%d location=%q", rec.Code, rec.Header().Get("Location"))
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].MaxAge >= 0 {
		t.Fatalf("esperava cookie de sessão expirado (MaxAge negativo), veio %+v", cookies)
	}
}
