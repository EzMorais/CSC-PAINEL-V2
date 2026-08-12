// Package gateway concentra os proxies temporários usados durante a migração gradual.
// Os módulos já migrados respondem diretamente do binário Go; os poucos que ainda vivem em
// processos separados continuam acessíveis pela mesma porta pública, sob um prefixo de URL.
package gateway

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// NovoProxy cria um proxy reverso que preserva caminho e query string da requisição. Isso é
// importante para o Frota, que usa basePath=/frota, e para o Portal legado em /cadastros.
func NovoProxy(destino string) (*httputil.ReverseProxy, error) {
	alvo, err := url.Parse(destino)
	if err != nil {
		return nil, err
	}
	if alvo.Scheme != "http" && alvo.Scheme != "https" {
		return nil, &url.Error{Op: "parse", URL: destino, Err: errEsquemaInvalido{}}
	}
	if alvo.Host == "" {
		return nil, &url.Error{Op: "parse", URL: destino, Err: errHostAusente{}}
	}

	proxy := httputil.NewSingleHostReverseProxy(alvo)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, erro error) {
		slog.Error("gateway: serviço interno indisponível", "destino", destino, "rota", r.URL.Path, "erro", erro)
		http.Error(w, "Módulo temporariamente indisponível. Tente novamente em instantes.", http.StatusBadGateway)
	}
	return proxy, nil
}

type errEsquemaInvalido struct{}

func (errEsquemaInvalido) Error() string {
	return "o endereço precisa começar com http:// ou https://"
}

type errHostAusente struct{}

func (errHostAusente) Error() string { return "o endereço precisa informar um host" }
