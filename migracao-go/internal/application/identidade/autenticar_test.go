package identidade

import (
	"context"
	"testing"

	"golang.org/x/crypto/bcrypt"

	dominio "siqueiracampos/servidor/internal/domain/identidade"
)

type usuariosFake struct {
	porEmail          map[string]*dominio.Usuario
	ultimoAcessoID    string
	ultimoAcessoConta int
}

func (f *usuariosFake) BuscarPorEmail(ctx context.Context, email string) (*dominio.Usuario, error) {
	if u, ok := f.porEmail[email]; ok {
		return u, nil
	}
	return nil, nil
}
func (f *usuariosFake) BuscarPorID(ctx context.Context, id string) (*dominio.Usuario, error) {
	for _, u := range f.porEmail {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}
func (f *usuariosFake) Listar(ctx context.Context) ([]dominio.Usuario, error) { return nil, nil }
func (f *usuariosFake) Criar(ctx context.Context, u *dominio.Usuario, modulos []dominio.Modulo) error {
	return nil
}
func (f *usuariosFake) AtualizarCargoEAcessos(ctx context.Context, id string, cargo dominio.Cargo, ativo bool, modulos []dominio.Modulo, papelFinanceiro dominio.PapelFinanceiro) error {
	return nil
}
func (f *usuariosFake) AtualizarSenha(ctx context.Context, id string, senhaHash string) error {
	return nil
}
func (f *usuariosFake) AtualizarUltimoAcesso(ctx context.Context, id string) error {
	f.ultimoAcessoID = id
	f.ultimoAcessoConta++
	return nil
}

type registrosFake struct {
	registros []dominio.RegistroAcesso
}

func (f *registrosFake) Registrar(ctx context.Context, r dominio.RegistroAcesso) error {
	f.registros = append(f.registros, r)
	return nil
}
func (f *registrosFake) Ultimos(ctx context.Context, limite int) ([]dominio.RegistroAcesso, error) {
	return f.registros, nil
}

func hashDe(t *testing.T, senha string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(senha), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return string(h)
}

func novoAutenticador(usuarios map[string]*dominio.Usuario) (*Autenticador, *usuariosFake, *registrosFake) {
	uf := &usuariosFake{porEmail: usuarios}
	rf := &registrosFake{}
	return &Autenticador{Usuarios: uf, Registros: rf}, uf, rf
}

func TestAutenticar_CredenciaisCorretas(t *testing.T) {
	u := &dominio.Usuario{
		ID: "u1", Nome: "Ana Teste", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "senha-correta"),
		Cargo: dominio.CargoOperacional, Ativo: true, Modulos: []dominio.Modulo{dominio.ModuloRH},
	}
	a, uf, rf := novoAutenticador(map[string]*dominio.Usuario{"ana@exemplo.com.br": u})

	sess, err := a.Autenticar(context.Background(), " Ana@Exemplo.com.br ", "senha-correta")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if sess == nil {
		t.Fatal("esperava sessão, veio nil — e-mail deveria ser normalizado (trim+lower) antes de buscar")
	}
	if sess.ID != u.ID || sess.Cargo != u.Cargo {
		t.Fatalf("sessão não confere com o usuário: %+v", sess)
	}
	if uf.ultimoAcessoID != u.ID || uf.ultimoAcessoConta != 1 {
		t.Errorf("AtualizarUltimoAcesso deveria ter sido chamado uma vez com o ID do usuário, veio id=%q conta=%d", uf.ultimoAcessoID, uf.ultimoAcessoConta)
	}
	if len(rf.registros) != 1 || !rf.registros[0].Sucesso {
		t.Fatalf("esperava 1 registro de acesso com sucesso, veio %+v", rf.registros)
	}
}

func TestAutenticar_SenhaErrada(t *testing.T) {
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "senha-correta"), Ativo: true}
	a, _, rf := novoAutenticador(map[string]*dominio.Usuario{"ana@exemplo.com.br": u})

	sess, err := a.Autenticar(context.Background(), "ana@exemplo.com.br", "senha-errada")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if sess != nil {
		t.Fatal("esperava nil para senha errada — falha de credencial não é erro de infraestrutura")
	}
	if len(rf.registros) != 1 || rf.registros[0].Sucesso || rf.registros[0].Motivo == nil || *rf.registros[0].Motivo != "senha incorreta" {
		t.Fatalf("esperava registro de falha com motivo 'senha incorreta', veio %+v", rf.registros)
	}
}

func TestAutenticar_UsuarioInativo(t *testing.T) {
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "senha-correta"), Ativo: false}
	a, _, rf := novoAutenticador(map[string]*dominio.Usuario{"ana@exemplo.com.br": u})

	sess, err := a.Autenticar(context.Background(), "ana@exemplo.com.br", "senha-correta")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if sess != nil {
		t.Fatal("usuário inativo não pode logar mesmo com senha certa")
	}
	if len(rf.registros) != 1 || rf.registros[0].Motivo == nil || *rf.registros[0].Motivo != "usuário inativo" {
		t.Fatalf("esperava motivo 'usuário inativo', veio %+v", rf.registros)
	}
}

// TestAutenticar_EmailInexistente prova o caminho "isca" (COMPORTAMENTO.md §2.1): mesmo sem
// usuário nenhum, a função sempre compara contra ALGUM hash bcrypt (hashIsca) antes de
// decidir — não pode retornar cedo demais, senão a AUSÊNCIA da comparação vira um jeito de
// medir, por tempo de resposta, se um e-mail tem conta ou não.
func TestAutenticar_EmailInexistente(t *testing.T) {
	a, _, rf := novoAutenticador(map[string]*dominio.Usuario{})

	sess, err := a.Autenticar(context.Background(), "ninguem@exemplo.com.br", "qualquer-coisa")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if sess != nil {
		t.Fatal("e-mail sem conta não pode logar")
	}
	if len(rf.registros) != 1 || rf.registros[0].Motivo == nil || *rf.registros[0].Motivo != "e-mail não cadastrado" {
		t.Fatalf("esperava motivo 'e-mail não cadastrado', veio %+v", rf.registros)
	}
}

func TestAutenticar_MesmaMensagemParaEmailInexistenteESenhaErrada(t *testing.T) {
	// O HANDLER (entrar.go) é quem garante a mensagem única ao usuário final — aqui só
	// confirmamos que o application layer devolve exatamente o mesmo formato (nil, nil) nos
	// dois casos, sem nenhum sinal que distinga um do outro pro chamador.
	u := &dominio.Usuario{ID: "u1", Nome: "Ana", Email: "ana@exemplo.com.br", SenhaHash: hashDe(t, "senha-correta"), Ativo: true}
	a1, _, _ := novoAutenticador(map[string]*dominio.Usuario{"ana@exemplo.com.br": u})
	a2, _, _ := novoAutenticador(map[string]*dominio.Usuario{})

	s1, e1 := a1.Autenticar(context.Background(), "ana@exemplo.com.br", "errada")
	s2, e2 := a2.Autenticar(context.Background(), "fantasma@exemplo.com.br", "errada")

	if s1 != s2 || e1 != e2 {
		t.Fatalf("os dois caminhos deveriam devolver exatamente (nil, nil): veio (%v,%v) e (%v,%v)", s1, e1, s2, e2)
	}
}
