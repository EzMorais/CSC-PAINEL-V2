package middleware

import (
	"context"
	"net/http"

	"siqueiracampos/servidor/internal/domain/identidade"
)

// chaveContexto evita colisão com chaves de outros pacotes que também usem context.Value —
// ver https://pkg.go.dev/context#WithValue (nunca usar string crua como chave).
type chaveContexto int

const (
	chaveSessao chaveContexto = iota
	chaveNavegacao
)

// Navegacao carrega as URLs dos módulos que ainda não migraram para este binário — usadas
// pela sidebar e pelo hub flutuante pra montar links cruzados (RH, Alojamentos).
type Navegacao struct {
	URLRH          string
	URLAlojamentos string
}

func ComSessao(ctx context.Context, sess *identidade.Sessao) context.Context {
	return context.WithValue(ctx, chaveSessao, sess)
}

// SessaoDoContexto devolve nil quando não há sessão (visitante deslogado) — quem chama trata
// isso como "não mostrar a casca autenticada", nunca como erro.
func SessaoDoContexto(ctx context.Context) *identidade.Sessao {
	sess, _ := ctx.Value(chaveSessao).(*identidade.Sessao)
	return sess
}

func ComNavegacao(ctx context.Context, nav Navegacao) context.Context {
	return context.WithValue(ctx, chaveNavegacao, nav)
}

func NavegacaoDoContexto(ctx context.Context) Navegacao {
	nav, _ := ctx.Value(chaveNavegacao).(Navegacao)
	return nav
}

// ComContextoDeRequisicao injeta sessão (se houver cookie válido) e as URLs de navegação
// cruzada no context.Context de toda requisição — é o único ponto que permite a `layout.Base`
// montar a sidebar sem que nenhum handler ou template-folha precise passar esses dados
// explicitamente. Ver migracao-go/README.md e o plano da reforma visual.
func ComContextoDeRequisicao(sessoes *Sessoes, nav Navegacao, proximo http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ComNavegacao(r.Context(), nav)
		if sess := sessoes.Ler(r); sess != nil {
			ctx = ComSessao(ctx, sess)
		}
		proximo.ServeHTTP(w, r.WithContext(ctx))
	})
}
