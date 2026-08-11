package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// respostaComStatus intercepta WriteHeader só pra guardar o código — o resto do
// http.ResponseWriter passa direto, sem buffering.
type respostaComStatus struct {
	http.ResponseWriter
	status int
}

func (r *respostaComStatus) WriteHeader(codigo int) {
	r.status = codigo
	r.ResponseWriter.WriteHeader(codigo)
}

// Logging registra cada requisição em log estruturado (log/slog, stdlib — sem dependência
// nova): método, rota, status, duração e usuário (se houver sessão). Lê a sessão direto do
// cookie, a mesma leitura barata que Sessoes.Ler já faz — não depende do valor que
// ComContextoDeRequisicao injeta no contexto mais adiante na cadeia, pra este middleware não
// precisar saber a ordem de composição dos outros.
func Logging(sessoes *Sessoes) func(http.Handler) http.Handler {
	return func(proximo http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			inicio := time.Now()
			rw := &respostaComStatus{ResponseWriter: w, status: http.StatusOK}
			proximo.ServeHTTP(rw, r)

			// r.Pattern é preenchido pelo ServeMux (Go 1.22+) durante o despacho, no MESMO
			// *http.Request — já está disponível aqui, depois que proximo.ServeHTTP retorna.
			// Cai pro path cru quando o mux não achou rota (404), onde Pattern fica vazio.
			rota := r.Pattern
			if rota == "" {
				rota = r.URL.Path
			}
			usuario := "anônimo"
			if sess := sessoes.Ler(r); sess != nil {
				usuario = sess.Email
			}
			slog.Info("requisição",
				"metodo", r.Method, "rota", rota, "status", rw.status,
				"duracao_ms", time.Since(inicio).Milliseconds(), "usuario", usuario,
			)
		})
	}
}
