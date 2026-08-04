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
	painel "siqueiracampos/servidor/internal/domain/painel"
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
		tabelas := []string{
			"registros_acesso", "acessos_modulo", "usuarios",
			"movimentacoes_locacao", "locacoes", "fornecedor_aliases", "fornecedores", "obras",
		}
		for _, tabela := range tabelas {
			if _, err := db.ExecContext(ctx, "DELETE FROM "+tabela); err != nil {
				log.Fatalf("resetar %s: %v", tabela, err)
			}
		}
		log.Println("Banco de teste resetado (SEED_RESET=1).")
	}

	semearAdmin(ctx, usuarios)
	semearExemplos(ctx, usuarios)

	repoObras := database.NovoObraRepositorio(db)
	repoFornecedores := database.NovoFornecedorRepositorio(db)
	semearPainel(ctx, repoObras, repoFornecedores)
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

type obraExemplo struct {
	cliente, codigo, descricao, responsavel, abaOrigem string
}

// Espelha prisma/dados-exemplo.ts do Painel Next.js — dados fictícios, não os reais da
// empresa (esses vivem só em dados-locais.json, gitignored, fora deste repo). EX-1010-25A
// e EX-1010-25B compartilham propositalmente o mesmo abaOrigem — é o que exercita
// obraAConfirmar/reclassificação nos testes, ver COMPORTAMENTO.md §6.5.
var obrasExemplo = []obraExemplo{
	{"ALFA INDUSTRIAL", "EX-1001-25", "CONSTRUÇÃO DE GALPÃO", "ana", "EX-1001-25_ALFA"},
	{"ALFA INDUSTRIAL", "EX-1002-25", "REDE DE DRENAGEM", "ana", "EX-1002-25_ALFA"},
	{"BETA LOGÍSTICA", "EX-1010-25A", "PRÉDIO ADMINISTRATIVO", "bruno", "EX-1010-25_BETA"},
	{"BETA LOGÍSTICA", "EX-1010-25B", "DOCA DE CARREGAMENTO", "bruno", "EX-1010-25_BETA"},
	{"GAMA ALIMENTOS", "EX-1020-26", "AMPLIAÇÃO DA FÁBRICA", "carla", "EX-1020-26_GAMA"},
	{"AVULSO", "AVULSO", "Controle avulso", "", "AVULSO"},
}

type fornecedorExemplo struct {
	nome, telefone string
	aliases        []string
}

var fornecedoresExemplo = []fornecedorExemplo{
	{"MAQLOC LOCAÇÕES", "(11) 4000-0001", []string{"MAQLOC", "MAQ LOC"}},
	{"LOK SOLUÇÕES", "(11) 4000-0002", []string{"LOK"}},
	{"KAISEN", "", nil},
}

func semearPainel(ctx context.Context, obras *database.ObraRepositorio, fornecedores *database.FornecedorRepositorio) {
	criadasObras := 0
	for _, e := range obrasExemplo {
		if existente, _ := obras.BuscarPorCodigo(ctx, e.codigo); existente != nil {
			continue
		}
		var responsavel *string
		if e.responsavel != "" {
			responsavel = &e.responsavel
		}
		o := &painel.Obra{Cliente: e.cliente, Codigo: e.codigo, Descricao: e.descricao, Responsavel: responsavel, AbaOrigem: e.abaOrigem}
		if err := obras.Criar(ctx, o); err != nil {
			log.Fatalf("criar obra %s: %v", e.codigo, err)
		}
		criadasObras++
	}

	criadosFornecedores := 0
	for _, e := range fornecedoresExemplo {
		if existente, _ := fornecedores.BuscarPorNomeNormalizado(ctx, painel.NormalizarTexto(e.nome)); existente != nil {
			continue
		}
		var telefone *string
		if e.telefone != "" {
			telefone = &e.telefone
		}
		f := &painel.Fornecedor{Nome: e.nome, Telefone: telefone, Aliases: e.aliases}
		if err := fornecedores.Criar(ctx, f); err != nil {
			log.Fatalf("criar fornecedor %s: %v", e.nome, err)
		}
		criadosFornecedores++
	}

	log.Printf("Painel de Locação: %d obras e %d fornecedores de exemplo criados (dados fictícios).", criadasObras, criadosFornecedores)
}
