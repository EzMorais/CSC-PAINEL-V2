package identidade

import (
	"context"
	"errors"
	"time"
)

// ErrEmailDuplicado é devolvido pelo repositório quando o e-mail já existe — a camada de
// aplicação traduz isto pra mensagem amigável de COMPORTAMENTO.md §5.
var ErrEmailDuplicado = errors.New("já existe um usuário com esse e-mail")

// UsuarioRepositorio é a porta (Hexagonal) que a aplicação usa — a implementação SQLite
// mora em internal/infrastructure/database. Ver ARQUITETURA.md §1.
type UsuarioRepositorio interface {
	BuscarPorEmail(ctx context.Context, email string) (*Usuario, error)
	BuscarPorID(ctx context.Context, id string) (*Usuario, error)
	Listar(ctx context.Context) ([]Usuario, error)
	// Criar grava o usuário e os acessos numa transação só, e preenche u.ID.
	Criar(ctx context.Context, u *Usuario, modulos []Modulo) error
	AtualizarCargoEAcessos(ctx context.Context, id string, cargo Cargo, ativo bool, modulos []Modulo) error
	AtualizarSenha(ctx context.Context, id string, senhaHash string) error
	AtualizarUltimoAcesso(ctx context.Context, id string) error
}

// RegistroAcesso é uma tentativa de login, com ou sem sucesso — ver COMPORTAMENTO.md §2.1.
type RegistroAcesso struct {
	ID       string
	Email    string
	Nome     *string
	Sucesso  bool
	Motivo   *string
	Ocorrido time.Time
}

type RegistroAcessoRepositorio interface {
	// Registrar nunca deve impedir o login por falhar — ver COMPORTAMENTO.md §2.1: quem
	// chama ignora o erro de propósito.
	Registrar(ctx context.Context, r RegistroAcesso) error
	Ultimos(ctx context.Context, limite int) ([]RegistroAcesso, error)
}
