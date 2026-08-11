package integracao

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const segredoTeste = "segredo-de-teste-com-mais-de-32-caracteres-000"

func TestNovoServico_RejeitaSegredoCurto(t *testing.T) {
	if _, err := NovoServico("curto"); err == nil {
		t.Fatal("esperava erro para segredo com menos de 32 caracteres")
	}
}

func TestAssinarEVerificar_RoundTrip(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	token, err := s.Assinar("estoque")
	if err != nil {
		t.Fatalf("assinar: %v", err)
	}

	origem, ok := s.Verificar("Bearer " + token)
	if !ok || origem != "estoque" {
		t.Fatalf("esperava origem=estoque ok=true, veio origem=%q ok=%v", origem, ok)
	}
}

func TestVerificar_SemToken(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Verificar(""); ok {
		t.Fatal("esperava ok=false para cabeçalho vazio")
	}
	if _, ok := s.Verificar("Bearer "); ok {
		t.Fatal("esperava ok=false para token vazio depois do prefixo")
	}
}

func TestVerificar_EmissorInvalido(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	token, err := s.Assinar("modulo-inexistente")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Verificar("Bearer " + token); ok {
		t.Fatal("esperava ok=false para emissor fora de EmissoresValidos")
	}
}

// TestVerificar_TokenDeSessaoNaoServe prova a checagem de `tipo` — um JWT válido assinado com
// o MESMO segredo mas sem `tipo: "integracao"` (ex.: um cookie de sessão de usuário comum) não
// pode ser aceito como credencial de máquina.
func TestVerificar_TokenDeSessaoNaoServe(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	c := struct {
		Origem string `json:"origem"`
		jwt.RegisteredClaims
	}{
		Origem: "estoque",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Verificar("Bearer " + token); ok {
		t.Fatal("esperava ok=false para token sem tipo=integracao")
	}
}

func TestVerificar_TokenExpirado(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	c := claims{
		Origem: "estoque", Tipo: "integracao",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Verificar("Bearer " + token); ok {
		t.Fatal("esperava ok=false para token expirado")
	}
}

// TestVerificar_RejeitaAlgoritmoDiferente prova a correção de segurança equivalente à de
// sessao.Servico.Ler: um token assinado com o mesmo segredo em HS384 precisa ser rejeitado
// porque o parser agora só aceita HS256.
func TestVerificar_RejeitaAlgoritmoDiferente(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	c := claims{
		Origem: "estoque", Tipo: "integracao",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS384, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Verificar("Bearer " + token); ok {
		t.Fatal("esperava rejeição de token assinado com algoritmo diferente de HS256")
	}
}
