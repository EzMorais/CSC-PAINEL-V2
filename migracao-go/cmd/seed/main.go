// Comando seed cria o primeiro administrador e as contas de exemplo — espelha
// prisma/seed.ts do Portal Next.js. Ver COMPORTAMENTO.md §7.
package main

import (
	"context"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"

	"siqueiracampos/servidor/internal/config"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

const emailAdmin = "admin@siqueiracampos.com.br"

func main() {
	cfg := config.Carregar()

	db, err := database.Abrir(cfg.CaminhoBanco)
	if err != nil {
		log.Fatalf("abrir banco: %v", err)
	}
	defer db.Close()

	if err := database.AplicarMigracoes(db); err != nil {
		log.Fatalf("aplicar migrações: %v", err)
	}

	usuarios := database.NovoUsuarioRepositorio(db)
	ctx := context.Background()

	// SEED_RESET=1 apaga as linhas via SQL em vez de apagar o arquivo do banco — usado
	// pela suíte e2e (ver apps/portal/e2e/apoio.ts). Apagar o ARQUIVO enquanto o servidor
	// (que mantém uma única conexão persistente, ver conexao.go) está no ar deixa a
	// conexão dele órfã; apagar as LINHAS é visto na próxima consulta normalmente.
	if os.Getenv("SEED_RESET") == "1" {
		for _, tabela := range []string{"registros_acesso", "acessos_modulo", "usuarios"} {
			if _, err := db.ExecContext(ctx, "DELETE FROM "+tabela); err != nil {
				log.Fatalf("resetar %s: %v", tabela, err)
			}
		}
		log.Println("Banco de teste resetado (SEED_RESET=1).")
	}

	semearAdmin(ctx, usuarios)
	semearExemplos(ctx, usuarios)
}

// semearAdmin usa Criar (que checa duplicidade), nunca upsert — rodar de novo não pode
// devolver a senha padrão a uma conta cuja senha já foi trocada. Ver COMPORTAMENTO.md §7.
func semearAdmin(ctx context.Context, usuarios *database.UsuarioRepositorio) {
	existente, err := usuarios.BuscarPorEmail(ctx, emailAdmin)
	if err != nil {
		log.Fatalf("buscar admin: %v", err)
	}
	if existente != nil {
		log.Printf("Usuário: %s já existe — senha preservada.", emailAdmin)
		return
	}

	senha := os.Getenv("SENHA_ADMIN")
	if senha == "" {
		senha = "locacao2026"
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(senha), 10)
	if err != nil {
		log.Fatalf("hash da senha: %v", err)
	}

	admin := &dominio.Usuario{Nome: "Administrador", Email: emailAdmin, SenhaHash: string(hash), Cargo: dominio.CargoAdmin}
	if err := usuarios.Criar(ctx, admin, nil); err != nil {
		log.Fatalf("criar admin: %v", err)
	}
	log.Printf("Usuário: %s criado (senha: %s) — troque no primeiro acesso.", emailAdmin, senha)
}

type exemplo struct {
	nome, email string
	cargo       dominio.Cargo
	modulos     []dominio.Modulo
}

// Mesmas 5 contas de demonstração do seed Next.js original — ver COMPORTAMENTO.md §7 e
// e2e/apoio.ts (a suíte Playwright depende exatamente destes e-mails/cargos/módulos).
var exemplos = []exemplo{
	{"Carla Diretoria", "diretoria@exemplo.com.br", dominio.CargoDiretoria, nil},
	{"Bruno Gerente", "gerente@exemplo.com.br", dominio.CargoGerente, []dominio.Modulo{dominio.ModuloEstoque, dominio.ModuloPainel}},
	{"Ana Almoxarife", "almoxarife@exemplo.com.br", dominio.CargoOperacional, []dominio.Modulo{dominio.ModuloEstoque}},
	{"Diego RH", "rh@exemplo.com.br", dominio.CargoOperacional, []dominio.Modulo{dominio.ModuloRH}},
	{"Marcos Mestre", "mestre@exemplo.com.br", dominio.CargoConsulta, []dominio.Modulo{dominio.ModuloPainel, dominio.ModuloRH}},
}

func semearExemplos(ctx context.Context, usuarios *database.UsuarioRepositorio) {
	criados := 0
	for _, e := range exemplos {
		existente, err := usuarios.BuscarPorEmail(ctx, e.email)
		if err != nil {
			log.Fatalf("buscar %s: %v", e.email, err)
		}
		if existente != nil {
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte("exemplo2026"), 10)
		if err != nil {
			log.Fatalf("hash da senha de exemplo: %v", err)
		}
		observacao := "Conta de exemplo criada pelo seed — apague antes de usar para valer."
		u := &dominio.Usuario{Nome: e.nome, Email: e.email, SenhaHash: string(hash), Cargo: e.cargo, Observacao: &observacao}
		if err := usuarios.Criar(ctx, u, e.modulos); err != nil {
			log.Fatalf("criar %s: %v", e.email, err)
		}
		criados++
	}
	if criados > 0 {
		log.Printf("Usuários de exemplo: %d criados (senha: exemplo2026) — apague antes de usar para valer.", criados)
	} else {
		log.Printf("Usuários de exemplo: já existiam.")
	}
}
