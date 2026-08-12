package gateway

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNovoProxy_PreservaCaminhoEConsulta(t *testing.T) {
	var caminho, consulta string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		caminho, consulta = r.URL.Path, r.URL.RawQuery
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	proxy, err := NovoProxy(upstream.URL)
	if err != nil {
		t.Fatalf("NovoProxy: %v", err)
	}
	gateway := httptest.NewServer(proxy)
	defer gateway.Close()

	resposta, err := http.Get(gateway.URL + "/frota/veiculos?pagina=2")
	if err != nil {
		t.Fatalf("GET gateway: %v", err)
	}
	defer resposta.Body.Close()
	if resposta.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d; esperado %d", resposta.StatusCode, http.StatusNoContent)
	}
	if caminho != "/frota/veiculos" || consulta != "pagina=2" {
		t.Fatalf("upstream recebeu caminho=%q consulta=%q", caminho, consulta)
	}
}

func TestNovoProxy_RejeitaDestinoInvalido(t *testing.T) {
	for _, destino := range []string{"", "localhost:3000", "ftp://exemplo.com"} {
		if _, err := NovoProxy(destino); err == nil {
			t.Errorf("NovoProxy(%q) deveria falhar", destino)
		}
	}
}
