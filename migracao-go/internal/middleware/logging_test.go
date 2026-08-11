package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/services/sessao"
)

func capturarLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	antigo := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(antigo) })
	return &buf
}

func TestLogging_RegistraMetodoRotaEStatus(t *testing.T) {
	buf := capturarLogs(t)
	sessoes := &Sessoes{}

	mw := Logging(sessoes)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest(http.MethodPost, "/almoxarifado/materiais", nil)
	mw.ServeHTTP(httptest.NewRecorder(), req)

	saida := buf.String()
	for _, esperado := range []string{"metodo=POST", "status=201", "usuario=anônimo"} {
		if !strings.Contains(saida, esperado) {
			t.Errorf("log não contém %q — saída completa: %s", esperado, saida)
		}
	}
}

func TestLogging_StatusPadraoDoisCentosQuandoNaoChamaWriteHeader(t *testing.T) {
	buf := capturarLogs(t)
	sessoes := &Sessoes{}

	mw := Logging(sessoes)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok")) // nunca chama WriteHeader explicitamente
	}))

	mw.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/entrar", nil))

	if !strings.Contains(buf.String(), "status=200") {
		t.Errorf("esperava status=200 por padrão, saída: %s", buf.String())
	}
}

func TestLogging_IncluiUsuarioComSessaoValida(t *testing.T) {
	buf := capturarLogs(t)

	servico, err := sessao.NovoServico("segredo-de-teste-com-mais-de-32-caracteres-000")
	if err != nil {
		t.Fatal(err)
	}
	sessoes := NovoSessoes(servico, false)

	token, err := servico.Emitir(identidade.Sessao{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", Cargo: identidade.CargoAdmin})
	if err != nil {
		t.Fatal(err)
	}

	mw := Logging(sessoes)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/rh", nil)
	req.AddCookie(&http.Cookie{Name: NomeCookie, Value: token})
	mw.ServeHTTP(httptest.NewRecorder(), req)

	if !strings.Contains(buf.String(), "usuario=ana@exemplo.com.br") {
		t.Errorf("esperava e-mail do usuário no log, veio: %s", buf.String())
	}
}
