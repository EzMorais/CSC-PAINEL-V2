package compras

import "strings"

type ErroValidacao struct{ Mensagens []string }

func (e *ErroValidacao) Error() string { return strings.Join(e.Mensagens, " ") }

func erroValidacao(msgs ...string) *ErroValidacao { return &ErroValidacao{Mensagens: msgs} }
