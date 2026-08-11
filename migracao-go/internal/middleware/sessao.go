// Package middleware liga os serviços de domínio ao transporte HTTP — leitura/escrita
// de cookie, redirecionamento. Ver ARQUITETURA.md §1.
package middleware

import (
	"net/http"

	"siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/services/sessao"
)

// NomeCookie é o mesmo nome que os 4 apps Next.js ainda não migrados esperam — não troque
// enquanto a migração não estiver completa. Ver COMPORTAMENTO.md §2.
const NomeCookie = "locacao_sessao"

const diasSessao = 7

type Sessoes struct {
	Servico *sessao.Servico
	// ForcaHTTPS vem de Config (única fonte de variável de ambiente do processo — ver
	// internal/config) — antes era lido direto de os.Getenv aqui, duplicando a leitura que
	// Config já faz na inicialização.
	ForcaHTTPS bool
}

func NovoSessoes(s *sessao.Servico, forcaHTTPS bool) *Sessoes {
	return &Sessoes{Servico: s, ForcaHTTPS: forcaHTTPS}
}

func (s *Sessoes) Criar(w http.ResponseWriter, sess identidade.Sessao) error {
	token, err := s.Servico.Emitir(sess)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: NomeCookie, Value: token, HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Path: "/", MaxAge: diasSessao * 24 * 60 * 60,
		// Sem HTTPS o cookie `secure` nunca é enviado, e o sistema roda em rede local por
		// HTTP — mesma condição de lib/auth.ts. Fica atrás de uma variável pra quem
		// colocar um proxy TLS na frente.
		Secure: s.ForcaHTTPS,
	})
	return nil
}

func (s *Sessoes) Ler(r *http.Request) *identidade.Sessao {
	c, err := r.Cookie(NomeCookie)
	if err != nil {
		return nil
	}
	sess, err := s.Servico.Ler(c.Value)
	if err != nil {
		return nil
	}
	return sess
}

func (s *Sessoes) Encerrar(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: NomeCookie, Value: "", Path: "/", MaxAge: -1})
}

// ExigirSessao é o piso de toda escrita e leitura protegida — equivalente Go de
// `exigirSessao()` em lib/auth.ts. O handler chamador deve `return` imediatamente quando
// ok=false: a resposta de redirecionamento já foi escrita.
func (s *Sessoes) ExigirSessao(w http.ResponseWriter, r *http.Request) (sess *identidade.Sessao, ok bool) {
	sess = s.Ler(r)
	if sess == nil {
		http.Redirect(w, r, "/entrar", http.StatusFound)
		return nil, false
	}
	return sess, true
}

func (s *Sessoes) ExigirAdmin(w http.ResponseWriter, r *http.Request) (sess *identidade.Sessao, ok bool) {
	sess, ok = s.ExigirSessao(w, r)
	if !ok {
		return nil, false
	}
	if sess.Cargo != identidade.CargoAdmin {
		http.Redirect(w, r, "/", http.StatusFound)
		return nil, false
	}
	return sess, true
}
