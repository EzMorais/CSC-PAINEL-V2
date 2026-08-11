package sessao

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"siqueiracampos/servidor/internal/domain/identidade"
)

const segredoTeste = "segredo-de-teste-com-mais-de-32-caracteres-000"

func sessaoExemplo() identidade.Sessao {
	return identidade.Sessao{
		ID: "u1", Nome: "Ana Teste", Email: "ana@exemplo.com.br",
		Cargo: identidade.CargoOperacional, Papel: identidade.CargoOperacional,
		Modulos: []identidade.Modulo{identidade.ModuloRH},
	}
}

func TestNovoServico_RejeitaSegredoCurto(t *testing.T) {
	if _, err := NovoServico("curto-demais"); err == nil {
		t.Fatal("esperava erro para segredo com menos de 32 caracteres")
	}
}

func TestNovoServico_AceitaSegredoValido(t *testing.T) {
	if _, err := NovoServico(segredoTeste); err != nil {
		t.Fatalf("segredo válido não deveria falhar: %v", err)
	}
}

func TestEmitirELer_RoundTrip(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	original := sessaoExemplo()

	token, err := s.Emitir(original)
	if err != nil {
		t.Fatalf("emitir: %v", err)
	}

	lida, err := s.Ler(token)
	if err != nil {
		t.Fatalf("ler: %v", err)
	}
	if lida.ID != original.ID || lida.Email != original.Email || lida.Cargo != original.Cargo {
		t.Fatalf("sessão lida difere da emitida: %+v vs %+v", lida, original)
	}
	if len(lida.Modulos) != 1 || lida.Modulos[0] != identidade.ModuloRH {
		t.Fatalf("módulos não sobreviveram ao round-trip: %+v", lida.Modulos)
	}
}

func TestLer_TokenAdulterado(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	token, err := s.Emitir(sessaoExemplo())
	if err != nil {
		t.Fatal(err)
	}

	// Flipa um caractere no meio da assinatura. O último caractere base64url pode ter
	// bits de padding sem significado e, dependendo do valor, outra letra decodifica para
	// os mesmos bytes; no meio a alteração sempre muda a assinatura.
	// sintaticamente válido (3 partes separadas por ponto), só com assinatura errada.
	partes := strings.Split(token, ".")
	ultima := partes[2]
	indice := len(ultima) / 2
	troca := byte('a')
	if ultima[indice] == 'a' {
		troca = 'b'
	}
	partes[2] = ultima[:indice] + string(troca) + ultima[indice+1:]
	adulterado := strings.Join(partes, ".")

	if _, err := s.Ler(adulterado); err == nil {
		t.Fatal("esperava erro para token com assinatura adulterada")
	}
}

func TestLer_TokenExpirado(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}

	agora := time.Now()
	c := claims{
		ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", Cargo: "OPERACIONAL", Papel: "OPERACIONAL",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(agora.Add(-48 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(agora.Add(-24 * time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.Ler(token); err == nil {
		t.Fatal("esperava erro para token expirado")
	}
}

// TestLer_RejeitaAlgoritmoDiferente prova a correção de segurança: um token assinado com o
// MESMO segredo mas em HS384 (assinatura válida sob aquele algoritmo) precisa ser rejeitado
// porque o parser agora só aceita HS256 — sem isso, um atacante que descobrisse o segredo por
// outro canal (ou explorasse confusão de algoritmo) poderia forjar tokens de sessão.
func TestLer_RejeitaAlgoritmoDiferente(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}

	c := claims{
		ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", Cargo: "ADMIN", Papel: "ADMIN",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS384, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.Ler(token); err == nil {
		t.Fatal("esperava rejeição de token assinado com algoritmo diferente de HS256")
	}
}

func TestLer_CargoAusenteCaiParaConsulta(t *testing.T) {
	s, err := NovoServico(segredoTeste)
	if err != nil {
		t.Fatal(err)
	}
	c := claims{
		ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
	if err != nil {
		t.Fatal(err)
	}

	lida, err := s.Ler(token)
	if err != nil {
		t.Fatal(err)
	}
	if lida.Cargo != identidade.CargoConsulta {
		t.Fatalf("esperava fallback para CONSULTA, veio %q", lida.Cargo)
	}
}
