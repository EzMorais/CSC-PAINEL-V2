// Package integracao assina e verifica o token de máquina usado nas chamadas HTTP entre
// módulos (ex.: Almoxarifado -> RH pra ficha de EPI) — não confunde com o cookie de sessão
// de usuário. Espelha lib/integracao.ts: mesmo AUTH_SECRET, HS256, claims {origem, tipo}.
package integracao

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const validadeSegundos = 60

var EmissoresValidos = map[string]bool{
	"estoque": true, "rh": true, "painel-locacao": true, "alojamentos": true, "portal": true,
}

type claims struct {
	Origem string `json:"origem"`
	Tipo   string `json:"tipo"`
	jwt.RegisteredClaims
}

type Servico struct{ segredo []byte }

func NovoServico(segredo string) (*Servico, error) {
	if len(segredo) < 32 {
		return nil, errors.New("AUTH_SECRET ausente ou curto demais para assinar token de integração")
	}
	return &Servico{segredo: []byte(segredo)}, nil
}

// Assinar emite um token de vida curta identificando o módulo de origem — não é sessão de
// usuário, é "este pedido veio do Almoxarifado".
func (s *Servico) Assinar(origem string) (string, error) {
	agora := time.Now()
	c := claims{
		Origem: origem, Tipo: "integracao",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(validadeSegundos * time.Second)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
}

// Verificar confere o cabeçalho Authorization: Bearer ... — devolve a origem se válido, ou
// "", false em qualquer problema (assinatura inválida, expirado, ou um token de SESSÃO de
// usuário tentando passar por token de integração).
func (s *Servico) Verificar(autorizacao string) (origem string, ok bool) {
	token := strings.TrimSpace(strings.TrimPrefix(autorizacao, "Bearer "))
	if token == "" {
		return "", false
	}
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (interface{}, error) {
		return s.segredo, nil
	})
	if err != nil || c.Tipo != "integracao" || !EmissoresValidos[c.Origem] {
		return "", false
	}
	return c.Origem, true
}
