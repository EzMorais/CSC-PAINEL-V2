// Comando seed cria o primeiro administrador e as contas de exemplo — espelha
// prisma/seed.ts do Portal Next.js. Ver COMPORTAMENTO.md §7.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	"siqueiracampos/servidor/internal/config"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
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
			"aprovacoes_estoque", "itens_solicitacao", "solicitacoes_compra", "movimentacoes_estoque", "materiais", "configuracao_email_estoque",
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

	repoMateriais := database.NovoEstoqueMaterialRepositorio(db)
	repoMovimentacoesEstoque := database.NovoEstoqueMovimentacaoRepositorio(db)
	repoSolicitacoes := database.NovoEstoqueSolicitacaoRepositorio(db)
	repoAprovacoesEstoque := database.NovoEstoqueAprovacaoRepositorio(db)
	semearEstoque(ctx, repoObras, repoMateriais, repoMovimentacoesEstoque, repoSolicitacoes, repoAprovacoesEstoque)
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

type materialExemplo struct {
	codigo, nome   string
	categoria      estoque.Categoria
	unidade        string
	estoqueMinimo  float64
	ca, validadeCA string
}

// Cobre os 4 cenários citados em estoque/COMPORTAMENTO.md §10: saldo OK, ABAIXO do mínimo,
// ZERADO (sem nenhuma movimentação) e um EPI com CA/validade preenchidos.
var materiaisExemplo = []materialExemplo{
	{"MAT-0001", "Cimento CP-II 50kg", estoque.CategoriaCimentoArgamassa, "SC", 50, "", ""},
	{"MAT-0002", "Areia média", estoque.CategoriaAgregado, "M3", 20, "", ""},
	{"MAT-0003", "Arame recozido 18", estoque.CategoriaConsumivel, "KG", 10, "", ""},
	{"MAT-0004", "Capacete de segurança", estoque.CategoriaEPI, "UN", 5, "31469", "2027-12-31"},
	{"MAT-0005", "Tábua de pinho 3m", estoque.CategoriaMadeira, "M", 30, "", ""},
}

func semearEstoque(
	ctx context.Context,
	obras *database.ObraRepositorio,
	materiais *database.EstoqueMaterialRepositorio,
	movimentacoes *database.EstoqueMovimentacaoRepositorio,
	solicitacoes *database.EstoqueSolicitacaoRepositorio,
	aprovacoes *database.EstoqueAprovacaoRepositorio,
) {
	ids := map[string]string{}
	criados := 0
	for _, e := range materiaisExemplo {
		m := &estoque.Material{Codigo: e.codigo, Nome: e.nome, Categoria: e.categoria, Unidade: e.unidade, EstoqueMinimo: e.estoqueMinimo}
		if e.ca != "" {
			m.CA = &e.ca
		}
		if e.validadeCA != "" {
			t, err := time.Parse("2006-01-02", e.validadeCA)
			if err != nil {
				log.Fatalf("validade do CA de %s: %v", e.codigo, err)
			}
			m.ValidadeCA = &t
		}
		if err := materiais.Criar(ctx, m); err != nil {
			if errors.Is(err, estoque.ErrCodigoMaterialDuplicado) {
				log.Printf("Almoxarifado: materiais de exemplo já existiam — pulando o resto do seed do módulo.")
				return
			}
			log.Fatalf("criar material %s: %v", e.codigo, err)
		}
		ids[e.codigo] = m.ID
		criados++
	}

	registradoPor := "Seed"
	criarMov := func(materialID string, tipo estoque.TipoMovimentacao, quantidade float64, valorUnitario *float64, obraID, funcionarioID, funcionarioNome *string) {
		mov := &estoque.Movimentacao{
			Tipo: tipo, Quantidade: quantidade, ValorUnitario: valorUnitario, OcorridoEm: time.Now().UTC(),
			RegistradoPor: &registradoPor, MaterialID: materialID, ObraID: obraID,
			FuncionarioID: funcionarioID, FuncionarioNome: funcionarioNome,
		}
		if err := movimentacoes.Criar(ctx, mov); err != nil {
			log.Fatalf("criar movimentação de %s: %v", materialID, err)
		}
	}
	precoCimento, precoAreia, precoCapacete, precoTabua := 32.50, 85.0, 45.0, 18.0

	criarMov(ids["MAT-0001"], estoque.MovEntrada, 200, &precoCimento, nil, nil, nil)
	criarMov(ids["MAT-0002"], estoque.MovEntrada, 15, &precoAreia, nil, nil, nil) // fica ABAIXO do mínimo (20) de propósito

	criarMov(ids["MAT-0004"], estoque.MovEntrada, 20, &precoCapacete, nil, nil, nil)
	funcionarioID, funcionarioNome := "func-exemplo-1", "João Operário"
	criarMov(ids["MAT-0004"], estoque.MovSaida, 3, nil, nil, &funcionarioID, &funcionarioNome)

	if obra, _ := obras.BuscarPorCodigo(ctx, "EX-1001-25"); obra != nil {
		criarMov(ids["MAT-0005"], estoque.MovEntrada, 100, &precoTabua, nil, nil, nil)
		criarMov(ids["MAT-0005"], estoque.MovSaida, 20, nil, &obra.ID, nil, nil)
	} else {
		criarMov(ids["MAT-0005"], estoque.MovEntrada, 100, &precoTabua, nil, nil, nil)
	}
	// MAT-0003 (Arame) fica sem nenhuma movimentação de propósito — cenário ZERADO.

	saldoNaEpoca, minimoNaEpoca := 15.0, 20.0
	s := &estoque.SolicitacaoCompra{
		Numero: "SC-2026-0001", RegistradoPor: &registradoPor,
		Itens: []estoque.ItemSolicitacao{{MaterialID: ids["MAT-0002"], Quantidade: 25, SaldoNaEpoca: saldoNaEpoca, MinimoNaEpoca: minimoNaEpoca}},
	}
	if err := solicitacoes.Criar(ctx, s); err != nil {
		log.Fatalf("criar solicitação de exemplo: %v", err)
	}

	dadosAjuste, err := json.Marshal(estoque.DadosAjusteInventario{MaterialID: ids["MAT-0003"], QuantidadeContada: 5})
	if err != nil {
		log.Fatalf("montar dados do ajuste de exemplo: %v", err)
	}
	aprovacao := &estoque.Aprovacao{
		Tipo: estoque.AprovacaoAjusteInventario, Dados: string(dadosAjuste),
		Resumo:        "Arame recozido 18: contagem de 5 KG contra 0 no sistema (sobra de 5).",
		SolicitanteID: "seed", SolicitanteNome: "Ana Almoxarife",
	}
	if err := aprovacoes.Criar(ctx, aprovacao); err != nil {
		log.Fatalf("criar aprovação de exemplo: %v", err)
	}

	log.Printf("Almoxarifado: %d materiais de exemplo criados, com histórico, 1 solicitação e 1 aprovação pendente.", criados)
}
