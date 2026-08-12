package identidade

import (
	"context"
	"errors"
	"net/mail"
	"strings"

	"golang.org/x/crypto/bcrypt"

	dominio "siqueiracampos/servidor/internal/domain/identidade"
)

// ErroValidacao junta as mensagens como o zod fazia em Next.js — ver actions/usuarios.ts.
type ErroValidacao struct{ Mensagens []string }

func (e *ErroValidacao) Error() string { return strings.Join(e.Mensagens, " ") }

func erroValidacao(msgs ...string) *ErroValidacao { return &ErroValidacao{Mensagens: msgs} }

type GerenciadorUsuarios struct {
	Usuarios dominio.UsuarioRepositorio
}

type EntradaCriarUsuario struct {
	Nome, Email, Senha, Cargo, Telefone, Observacao string
	Modulos                                         []string
	PapelFinanceiro                                 string
}

func ponteiroSeNaoVazio(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func validarCargoEModulos(cargoStr string, modulosStr []string) (dominio.Cargo, []dominio.Modulo, []string) {
	var erros []string

	cargo := dominio.Cargo(cargoStr)
	if !cargo.Valido() {
		erros = append(erros, "Cargo inválido.")
	}

	modulos := make([]dominio.Modulo, 0, len(modulosStr))
	for _, m := range modulosStr {
		mm := dominio.Modulo(m)
		if !mm.Valido() {
			erros = append(erros, "Módulo inválido.")
			continue
		}
		modulos = append(modulos, mm)
	}
	return cargo, modulos, erros
}

func validarPapelFinanceiro(papelStr string) (dominio.PapelFinanceiro, []string) {
	papel := dominio.PapelFinanceiro(papelStr)
	if papel == "" {
		papel = dominio.PapelFinanceiroNenhum
	}
	if !papel.Valido() {
		return papel, []string{"Papel do Financeiro inválido."}
	}
	return papel, nil
}

// Criar espelha `criarUsuario` de actions/usuarios.ts — ver COMPORTAMENTO.md §5.
func (g *GerenciadorUsuarios) Criar(ctx context.Context, e EntradaCriarUsuario) (*dominio.Usuario, error) {
	var erros []string

	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 3 {
		erros = append(erros, "Informe o nome completo.")
	}

	email := strings.ToLower(strings.TrimSpace(e.Email))
	if _, err := mail.ParseAddress(email); err != nil {
		erros = append(erros, "E-mail inválido.")
	}

	if len(e.Senha) < 8 {
		erros = append(erros, "A senha precisa de pelo menos 8 caracteres.")
	}

	cargo, modulos, errosCargo := validarCargoEModulos(e.Cargo, e.Modulos)
	erros = append(erros, errosCargo...)

	papelFinanceiro, errosPapel := validarPapelFinanceiro(e.PapelFinanceiro)
	erros = append(erros, errosPapel...)

	if len(erros) > 0 {
		return nil, erroValidacao(erros...)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(e.Senha), 10)
	if err != nil {
		return nil, err
	}

	u := &dominio.Usuario{
		Nome: nome, Email: email, SenhaHash: string(hash), Cargo: cargo, Ativo: true,
		Telefone: ponteiroSeNaoVazio(e.Telefone), Observacao: ponteiroSeNaoVazio(e.Observacao),
		PapelFinanceiro: papelFinanceiro,
	}

	if err := g.Usuarios.Criar(ctx, u, modulos); err != nil {
		if errors.Is(err, dominio.ErrEmailDuplicado) {
			return nil, erroValidacao("Já existe um usuário com esse e-mail.")
		}
		return nil, err
	}
	u.Modulos = modulos
	return u, nil
}

type EntradaEditarUsuario struct {
	Cargo           string
	Ativo           bool
	Modulos         []string
	PapelFinanceiro string
}

// Editar bloqueia autoedição — ver COMPORTAMENTO.md §5: sem essa trava um admin
// distraído se rebaixa e ninguém mais consegue desfazer sem mexer direto no banco.
func (g *GerenciadorUsuarios) Editar(ctx context.Context, admin dominio.Sessao, alvoID string, e EntradaEditarUsuario) error {
	if alvoID == admin.ID {
		return erroValidacao("Você não pode mudar o próprio cargo nem se desativar. Peça a outro administrador.")
	}

	cargo, modulos, erros := validarCargoEModulos(e.Cargo, e.Modulos)
	papelFinanceiro, errosPapel := validarPapelFinanceiro(e.PapelFinanceiro)
	erros = append(erros, errosPapel...)
	if len(erros) > 0 {
		return erroValidacao(erros...)
	}

	return g.Usuarios.AtualizarCargoEAcessos(ctx, alvoID, cargo, e.Ativo, modulos, papelFinanceiro)
}

func (g *GerenciadorUsuarios) RedefinirSenha(ctx context.Context, alvoID, novaSenha string) error {
	if len(novaSenha) < 8 {
		return erroValidacao("A senha precisa de pelo menos 8 caracteres.")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(novaSenha), 10)
	if err != nil {
		return err
	}
	return g.Usuarios.AtualizarSenha(ctx, alvoID, string(hash))
}
