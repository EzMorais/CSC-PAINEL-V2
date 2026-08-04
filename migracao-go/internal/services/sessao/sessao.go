// Package sessao emite e lê o crachá de sessão — o JWT compartilhado com os apps Next.js
// ainda não migrados. Ver migracao-go/portal/COMPORTAMENTO.md §2.
package sessao

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"siqueiracampos/servidor/internal/domain/identidade"
)

const dias = 7

// claims espelha exatamente o payload que `jose` grava no Portal Next.js — mesmos nomes de
// campo, mesmo algoritmo (HS256), mesmo segredo — pra um app ainda em Next.js continuar
// validando um token emitido por este binário, e vice-versa, durante a transição.
type claims struct {
	ID      string   `json:"id"`
	Nome    string   `json:"nome"`
	Email   string   `json:"email"`
	Cargo   string   `json:"cargo"`
	Modulos []string `json:"modulos"`
	// Papel é cópia de Cargo — ver COMPORTAMENTO.md §2, mantida pra módulos Next.js que
	// ainda leem o campo antigo.
	Papel string `json:"papel"`
	jwt.RegisteredClaims
}

type Servico struct {
	segredo []byte
}

// NovoServico falha cedo se o segredo for curto demais — mesmo comportamento de
// `segredo()` em lib/auth.ts: todos os módulos precisam do MESMO AUTH_SECRET.
func NovoServico(segredo string) (*Servico, error) {
	if len(segredo) < 32 {
		return nil, errors.New("AUTH_SECRET ausente ou curto demais: todos os módulos precisam do mesmo valor")
	}
	return &Servico{segredo: []byte(segredo)}, nil
}

func (s *Servico) Emitir(sess identidade.Sessao) (string, error) {
	modulos := make([]string, len(sess.Modulos))
	for i, m := range sess.Modulos {
		modulos[i] = string(m)
	}

	agora := time.Now()
	c := claims{
		ID: sess.ID, Nome: sess.Nome, Email: sess.Email,
		Cargo: string(sess.Cargo), Modulos: modulos, Papel: string(sess.Papel),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(dias * 24 * time.Hour)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.segredo)
}

// Ler nunca retorna erro pro chamador tratar como exceção — assinatura inválida, expirado
// ou adulterado tudo vira token inválido; ver COMPORTAMENTO.md §2 ("verificação nunca
// lança"). O único uso do erro aqui é decidir se o resultado é válido.
func (s *Servico) Ler(token string) (*identidade.Sessao, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (interface{}, error) {
		return s.segredo, nil
	})
	if err != nil {
		return nil, err
	}

	cargo, papel := c.Cargo, c.Papel
	if cargo == "" {
		cargo = papel
	}
	if papel == "" {
		papel = cargo
	}
	if cargo == "" {
		cargo = string(identidade.CargoConsulta)
		papel = cargo
	}

	modulos := make([]identidade.Modulo, len(c.Modulos))
	for i, m := range c.Modulos {
		modulos[i] = identidade.Modulo(m)
	}

	return &identidade.Sessao{
		ID: c.ID, Nome: c.Nome, Email: c.Email,
		Cargo: identidade.Cargo(cargo), Modulos: modulos, Papel: identidade.Cargo(papel),
	}, nil
}
