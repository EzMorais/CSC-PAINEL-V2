// Package identidade orquestra domínio + portas de repositório — os casos de uso do
// antigo Portal. Ver ARQUITETURA.md §1: esta camada não sabe que o banco é SQLite.
package identidade

import (
	"context"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	dominio "siqueiracampos/servidor/internal/domain/identidade"
)

// hashIsca é um hash bcrypt válido de uma senha aleatória descartada — nunca abre
// nenhuma conta. Ver COMPORTAMENTO.md §2.1: comparar contra ele quando o e-mail não
// existe gasta o mesmo tempo que compararia com um hash real, o que impede a ausência
// da comparação virar um jeito de descobrir quais e-mails têm conta.
const hashIsca = "$2b$10$m49xnZxxbkiPAH.XVggfuekBiWQuoFwVADM1GjTNAVYKbRHxJiYAa"

type Autenticador struct {
	Usuarios  dominio.UsuarioRepositorio
	Registros dominio.RegistroAcessoRepositorio
}

// Autenticar devolve (nil, nil) — não um erro — quando as credenciais não conferem.
// Erro de verdade é só falha de infraestrutura (banco fora do ar etc).
func (a *Autenticador) Autenticar(ctx context.Context, email, senha string) (*dominio.Sessao, error) {
	limpo := strings.ToLower(strings.TrimSpace(email))

	u, err := a.Usuarios.BuscarPorEmail(ctx, limpo)
	if err != nil {
		return nil, err
	}

	hashAlvo := hashIsca
	if u != nil {
		hashAlvo = u.SenhaHash
	}
	confere := bcrypt.CompareHashAndPassword([]byte(hashAlvo), []byte(senha)) == nil

	if u == nil || !u.Ativo || !confere {
		a.registrarFalha(ctx, limpo, u)
		return nil, nil
	}

	nome := u.Nome
	_ = a.Registros.Registrar(ctx, dominio.RegistroAcesso{Email: limpo, Nome: &nome, Sucesso: true, Ocorrido: time.Now()})
	_ = a.Usuarios.AtualizarUltimoAcesso(ctx, u.ID)

	return &dominio.Sessao{
		ID: u.ID, Nome: u.Nome, Email: u.Email,
		Cargo: u.Cargo, Modulos: u.Modulos, Papel: u.Cargo,
	}, nil
}

// registrarFalha nunca bloqueia o login por erro de auditoria — ver COMPORTAMENTO.md §2.1.
func (a *Autenticador) registrarFalha(ctx context.Context, email string, u *dominio.Usuario) {
	motivo := "senha incorreta"
	var nome *string
	switch {
	case u == nil:
		motivo = "e-mail não cadastrado"
	case !u.Ativo:
		motivo = "usuário inativo"
	}
	if u != nil {
		nome = &u.Nome
	}
	_ = a.Registros.Registrar(ctx, dominio.RegistroAcesso{
		Email: email, Nome: nome, Sucesso: false, Motivo: &motivo, Ocorrido: time.Now(),
	})
}
