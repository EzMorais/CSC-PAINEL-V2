// Comando seed cria o primeiro administrador e as contas de exemplo — espelha
// prisma/seed.ts do Portal Next.js. Ver COMPORTAMENTO.md §7.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"siqueiracampos/servidor/internal/config"
	estoque "siqueiracampos/servidor/internal/domain/estoque"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	painel "siqueiracampos/servidor/internal/domain/painel"
	rh "siqueiracampos/servidor/internal/domain/rh"
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
			// RH — filhos antes de pais (foreign_keys = ON): nao_conformidades referencia
			// auditoria_itens, que referencia auditorias; documentos/exames/entregas_*/
			// eventos/dependentes referenciam funcionarios, que referencia obras/cargos/
			// departamentos.
			"nao_conformidades", "auditoria_itens", "auditorias",
			"documentos", "exames", "entregas_epi", "treinamento_participantes", "treinamentos", "entregas_uniforme",
			"eventos", "dependentes", "funcionarios", "departamentos", "cargos",
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

	repoRHCargos := database.NovoRHCargoRepositorio(db)
	repoRHDepartamentos := database.NovoRHDepartamentoRepositorio(db)
	repoRHFuncionarios := database.NovoRHFuncionarioRepositorio(db)
	repoRHEventos := database.NovoRHEventoRepositorio(db)
	repoRHTreinamentos := database.NovoRHTreinamentoRepositorio(db)
	repoRHUniformes := database.NovoRHUniformeRepositorio(db)
	repoRHExames := database.NovoRHExameRepositorio(db)
	repoRHDocumentos := database.NovoRHDocumentoRepositorio(db)
	semearRH(ctx, repoObras, repoRHCargos, repoRHDepartamentos, repoRHFuncionarios, repoRHEventos, repoRHTreinamentos, repoRHUniformes, repoRHExames, repoRHDocumentos)
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

type cargoExemploRH struct {
	nome, cbo, risco string
}

// Mesmos 10 cargos de prisma/dados-exemplo.ts do RH Next.js — ver rh/COMPORTAMENTO.md §10.
var cargosExemploRH = []cargoExemploRH{
	{"Pedreiro", "7152-10", rh.RiscoNormal},
	{"Servente de obras", "7170-20", rh.RiscoNormal},
	{"Carpinteiro", "7155-10", rh.RiscoNormal},
	{"Armador de ferragem", "7153-05", rh.RiscoNormal},
	{"Eletricista de obras", "7156-15", rh.RiscoPericuloso},
	{"Soldador", "7243-15", rh.RiscoInsalubre},
	{"Operador de máquinas", "7151-20", rh.RiscoPericuloso},
	{"Mestre de obras", "7102-10", rh.RiscoNormal},
	{"Técnico em segurança", "3516-05", rh.RiscoNormal},
	{"Auxiliar administrativo", "4110-05", rh.RiscoNormal},
}

type funcionarioExemploRH struct {
	nome, cpf, obraCodigo, cargoNome, status, telefone string
	admitidoHaDias                                     int
}

// Mesmos 14 funcionários de prisma/dados-exemplo.ts do RH Next.js (mesmos códigos de obra
// do Painel — é assim que os dois cadastros se reconhecem) — ver rh/COMPORTAMENTO.md §10 e
// apps/rh/e2e/apoio.go.ts `ESPERADO`/`FIXTURE` (a suíte Playwright depende exatamente
// destes nomes/CPFs/obras/cargos/status).
var funcionariosExemploRH = []funcionarioExemploRH{
	{"JOÃO BATISTA SILVEIRA", "52998224725", "EX-1001-25", "Mestre de obras", rh.StatusAtivo, "(11) 90000-0001", 940},
	{"ANTÔNIO PEREIRA LIMA", "11144477735", "EX-1001-25", "Pedreiro", rh.StatusAtivo, "(11) 90000-0002", 620},
	{"CARLOS EDUARDO ROCHA", "39053344705", "EX-1001-25", "Servente de obras", rh.StatusAtivo, "(11) 90000-0003", 410},
	{"MARCOS VINÍCIUS ALVES", "69331867093", "EX-1002-25", "Eletricista de obras", rh.StatusAtivo, "(11) 90000-0004", 300},
	{"PAULO HENRIQUE COSTA", "04546487070", "EX-1002-25", "Soldador", rh.StatusAtivo, "(11) 90000-0005", 250},
	{"RAFAEL AUGUSTO MENDES", "85770693037", "EX-1010-25A", "Carpinteiro", rh.StatusAtivo, "(11) 90000-0006", 180},
	{"FERNANDA APARECIDA DIAS", "15350946056", "EX-1010-25A", "Técnico em segurança", rh.StatusAtivo, "(11) 90000-0007", 150},
	{"JOSÉ ROBERTO NASCIMENTO", "20688429041", "EX-1010-25B", "Armador de ferragem", rh.StatusFerias, "(11) 90000-0008", 720},
	{"LUCIANA MARTINS SOUZA", "47817148031", "EX-1010-25B", "Auxiliar administrativo", rh.StatusAtivo, "(11) 90000-0009", 90},
	{"SEBASTIÃO GOMES FARIA", "35045179560", "EX-1020-26", "Operador de máquinas", rh.StatusAfastado, "(11) 90000-0010", 520},
	{"ADRIANO CÉSAR BARBOSA", "62491959046", "EX-1020-26", "Pedreiro", rh.StatusAtivo, "(11) 90000-0011", 60},
	{"WELLINGTON SANTOS CRUZ", "93713237018", "EX-1020-26", "Servente de obras", rh.StatusAtivo, "(11) 90000-0012", 25},
	// Sem obra e sem cargo de propósito — alimenta o indicador de cadastro incompleto.
	{"DIEGO FERREIRA PINTO", "29585903059", "", "", rh.StatusAtivo, "", 10},
	{"MARIA DE LOURDES RAMOS", "83219432093", "EX-1001-25", "Servente de obras", rh.StatusDesligado, "(11) 90000-0014", 800},
}

// nivelObraDoCargo espelha `nivelDoCargo()` de prisma/seed.ts do RH Next.js — só para os
// dados de exemplo terem algo plausível, não é regra de negócio (ver rh/COMPORTAMENTO.md §3:
// profissão e nível são eixos independentes).
func nivelObraDoCargo(cargoNome string) string {
	n := strings.ToLower(cargoNome)
	switch {
	case strings.Contains(n, "mestre"):
		return "MESTRE_DE_OBRAS"
	case strings.Contains(n, "encarregado"):
		return "ENCARREGADO"
	case strings.Contains(n, "engenheiro"):
		return "ENGENHEIRO"
	case strings.Contains(n, "servente"), strings.Contains(n, "ajudante"):
		return "SERVENTE_AJUDANTE"
	case strings.Contains(n, "auxiliar"), strings.Contains(n, "técnico"):
		return "" // escritório
	case n == "":
		return ""
	}
	return "OFICIAL"
}

func haDiasRH(dias int) time.Time {
	agora := time.Now().UTC()
	hoje := time.Date(agora.Year(), agora.Month(), agora.Day(), 0, 0, 0, 0, time.UTC)
	return hoje.AddDate(0, 0, -dias)
}

func semearRH(
	ctx context.Context,
	obras *database.ObraRepositorio,
	cargos *database.RHCargoRepositorio,
	departamentos *database.RHDepartamentoRepositorio,
	funcionarios *database.RHFuncionarioRepositorio,
	eventos *database.RHEventoRepositorio,
	treinamentos rh.TreinamentoRepositorio,
	uniformes rh.EntregaUniformeRepositorio,
	exames rh.ExameRepositorio,
	documentos rh.DocumentoRepositorio,
) {
	idsCargos := map[string]string{}
	criadosCargos := 0
	for _, e := range cargosExemploRH {
		if existente, _ := cargos.BuscarPorNome(ctx, e.nome); existente != nil {
			idsCargos[e.nome] = existente.ID
			continue
		}
		cbo := e.cbo
		c := &rh.Cargo{Nome: e.nome, CBO: &cbo, Risco: e.risco}
		if err := cargos.Criar(ctx, c); err != nil {
			log.Fatalf("criar cargo %s: %v", e.nome, err)
		}
		idsCargos[e.nome] = c.ID
		criadosCargos++
	}

	// Organograma reduzido — 2 ramos + 2 setores cada (versão completa do Next.js tem 19
	// setores; aqui só o suficiente pra validar os dois níveis). "Obras" é o setor que
	// nivelObraDoCargo aponta pra quem trabalha em canteiro — ver rh/COMPORTAMENTO.md §10.
	organogramaRH := map[string][]string{
		"Administrativo": {"RH", "Financeiro"},
		"Engenharia":     {"Obras", "Planejamento"},
	}
	idsDepartamentos := map[string]string{}
	criadosDepartamentos := 0
	for ramo, setores := range organogramaRH {
		idRamo, ja := idsDepartamentos[ramo]
		if !ja {
			if existente, _ := departamentos.BuscarPorNome(ctx, ramo); existente != nil {
				idRamo = existente.ID
			} else {
				d := &rh.Departamento{Nome: ramo}
				if err := departamentos.Criar(ctx, d); err != nil {
					log.Fatalf("criar ramo %s: %v", ramo, err)
				}
				idRamo = d.ID
				criadosDepartamentos++
			}
			idsDepartamentos[ramo] = idRamo
		}
		for _, setor := range setores {
			if existente, _ := departamentos.BuscarPorNome(ctx, setor); existente != nil {
				idsDepartamentos[setor] = existente.ID
				continue
			}
			d := &rh.Departamento{Nome: setor, PaiID: &idRamo}
			if err := departamentos.Criar(ctx, d); err != nil {
				log.Fatalf("criar setor %s: %v", setor, err)
			}
			idsDepartamentos[setor] = d.ID
			criadosDepartamentos++
		}
	}
	idSetorObras := idsDepartamentos["Obras"]

	idsFuncionarios := map[string]string{}
	criadosFuncionarios, pulados := 0, 0
	for i, e := range funcionariosExemploRH {
		if existente, _ := funcionarios.BuscarPorCPF(ctx, e.cpf); existente != nil {
			idsFuncionarios[e.nome] = existente.ID
			pulados++
			continue
		}

		var obraID, cargoID, departamentoID, nivelObra *string
		if e.obraCodigo != "" {
			if o, _ := obras.BuscarPorCodigo(ctx, e.obraCodigo); o != nil {
				id := o.ID
				obraID = &id
			}
		}
		if e.cargoNome != "" {
			if id, ok := idsCargos[e.cargoNome]; ok {
				cargoID = &id
			}
		}
		if nivel := nivelObraDoCargo(e.cargoNome); nivel != "" {
			nivelObra = &nivel
			departamentoID = &idSetorObras
		}

		admitidoEm := haDiasRH(e.admitidoHaDias)
		var telefone *string
		if e.telefone != "" {
			t := e.telefone
			telefone = &t
		}
		matricula := fmt.Sprintf("SC-%04d", i+1)

		f := &rh.Funcionario{
			Matricula: matricula, Nome: e.nome, CPF: e.cpf, Status: e.status, AdmitidoEm: admitidoEm,
			TipoContrato: "CLT", Telefone: telefone, ObraID: obraID, CargoID: cargoID,
			DepartamentoID: departamentoID, NivelObra: nivelObra,
		}
		registradoPor := "Seed"
		descricao := "Admitido"
		if obraID != nil {
			descricao = "Admitido na obra " + e.obraCodigo
		}
		evento := &rh.Evento{
			Tipo: rh.EventoAdmissao, DescricaoHumana: descricao, OcorridoEm: admitidoEm,
			RegistradoPor: &registradoPor, ObraID: obraID,
		}
		if err := funcionarios.Criar(ctx, f, evento); err != nil {
			log.Fatalf("criar funcionário %s: %v", e.nome, err)
		}
		idsFuncionarios[e.nome] = f.ID
		criadosFuncionarios++
	}
	_ = eventos // reservado para próximas fatias (exames/documentos/auditorias lançam eventos próprios)

	log.Printf("RH: %d cargos, %d departamentos, %d funcionários criados%s.",
		criadosCargos, criadosDepartamentos, criadosFuncionarios,
		condicional(pulados > 0, fmt.Sprintf(" (%d já existiam)", pulados), ""))

	semearRHTreinamentos(ctx, treinamentos, idsFuncionarios)
	semearRHUniformes(ctx, uniformes, idsFuncionarios)
	semearRHExames(ctx, exames, idsFuncionarios)
	semearRHDocumentos(ctx, documentos, obras, idsFuncionarios)
}

// semearRHDocumentos — fixture nova, plano exato em apps/rh/e2e/apoio.go.ts `FIXTURE`.
// Idempotente: pula pela combinação título+categoria+vínculo (mesma regra de versionamento
// do domínio, COMPORTAMENTO.md §3).
func semearRHDocumentos(ctx context.Context, repo rh.DocumentoRepositorio, obras *database.ObraRepositorio, idsFuncionarios map[string]string) {
	existentes, err := repo.Listar(ctx)
	if err != nil {
		log.Fatalf("listar documentos: %v", err)
	}
	jaExiste := map[string]bool{}
	for _, d := range existentes {
		jaExiste[d.Titulo+"|"+d.Categoria] = true
	}

	criar := func(titulo, categoria string, obraCodigo, funcionarioNome string, validoAteHaDias *int) {
		if jaExiste[titulo+"|"+categoria] {
			return
		}
		var obraID, funcionarioID *string
		if obraCodigo != "" {
			if o, _ := obras.BuscarPorCodigo(ctx, obraCodigo); o != nil {
				id := o.ID
				obraID = &id
			}
		}
		if funcionarioNome != "" {
			id, ok := idsFuncionarios[funcionarioNome]
			if !ok {
				log.Fatalf("documento %s: funcionário %s não encontrado no seed", titulo, funcionarioNome)
			}
			funcionarioID = &id
		}
		var validoAte *time.Time
		if validoAteHaDias != nil {
			v := haDiasRH(*validoAteHaDias)
			validoAte = &v
		}
		vigenteDesde := haDiasRH(30)
		registradoPor := "Seed"
		d := &rh.Documento{
			Categoria: categoria, Titulo: titulo, Versao: 1, VigenteDesde: &vigenteDesde, ValidoAte: validoAte,
			RegistradoPor: &registradoPor, ObraID: obraID, FuncionarioID: funcionarioID,
		}
		if err := repo.Criar(ctx, d); err != nil {
			log.Fatalf("criar documento %s: %v", titulo, err)
		}
	}

	menos10 := -10
	criar("PGR", rh.DocEmpresaPGR, "EX-1001-25", "", nil)
	criar("PCMSO", rh.DocEmpresaPCMSO, "EX-1002-25", "", &menos10)
	criar("RG", rh.DocPessoalRG, "", "PAULO HENRIQUE COSTA", nil)

	log.Printf("RH: documentos de exemplo verificados (PGR/PCMSO/RG).")
}

// semearRHExames — fixture nova, plano exato em apps/rh/e2e/apoio.go.ts `FIXTURE`.
// Idempotente: pula pela combinação funcionário+tipo.
func semearRHExames(ctx context.Context, repo rh.ExameRepositorio, idsFuncionarios map[string]string) {
	existentes, err := repo.Listar(ctx)
	if err != nil {
		log.Fatalf("listar exames: %v", err)
	}
	jaExiste := map[string]bool{}
	for _, e := range existentes {
		jaExiste[e.FuncionarioNome+"|"+e.Tipo] = true
	}

	type exameExemplo struct {
		funcionario, tipo, resultado string
		realizadoHaDias              int
		validadeHaDias               *int // negativo = no futuro (haDiasRH inverte o sinal)
	}
	menos5, menos20, menos185 := -5, -20, -185
	exemplos := []exameExemplo{
		{"PAULO HENRIQUE COSTA", rh.ExamePeriodico, rh.ResultadoApto, 360, &menos5},
		{"FERNANDA APARECIDA DIAS", rh.ExamePeriodico, rh.ResultadoApto, 345, &menos20},
		{"RAFAEL AUGUSTO MENDES", rh.ExameAdmissional, rh.ResultadoAptoComRestricao, 180, &menos185},
	}

	criados := 0
	for _, ex := range exemplos {
		if jaExiste[ex.funcionario+"|"+ex.tipo] {
			continue
		}
		id, ok := idsFuncionarios[ex.funcionario]
		if !ok {
			log.Fatalf("exame: funcionário %s não encontrado no seed", ex.funcionario)
		}
		var validadeEm *time.Time
		if ex.validadeHaDias != nil {
			v := haDiasRH(*ex.validadeHaDias)
			validadeEm = &v
		}
		registradoPor := "Seed"
		e := &rh.Exame{
			Tipo: ex.tipo, RealizadoEm: haDiasRH(ex.realizadoHaDias), ValidadeEm: validadeEm,
			Resultado: ex.resultado, RegistradoPor: &registradoPor, FuncionarioID: id,
		}
		if err := repo.Criar(ctx, e); err != nil {
			log.Fatalf("criar exame de %s: %v", ex.funcionario, err)
		}
		criados++
	}
	log.Printf("RH: %d exames de exemplo criados.", criados)
}

// semearRHTreinamentos — fixture nova (o Next.js não tinha treinamentos), plano exato
// documentado em apps/rh/e2e/apoio.go.ts `FIXTURE`. Idempotente: pula pela Descricao.
func semearRHTreinamentos(ctx context.Context, repo rh.TreinamentoRepositorio, idsFuncionarios map[string]string) {
	existentes, err := repo.Listar(ctx, "")
	if err != nil {
		log.Fatalf("listar treinamentos: %v", err)
	}
	jaExiste := map[string]bool{}
	for _, t := range existentes {
		jaExiste[t.Descricao] = true
	}

	type turmaExemplo struct {
		norma, descricao          string
		realizadoHaDias           int
		validadeHaDias            *int // negativo = no futuro (haDiasRH inverte o sinal)
		participantes             []string
	}
	menos15, menos35 := -15, 35
	turmas := []turmaExemplo{
		{rh.NormaNR35, "Trabalho em Altura — Turma A", 400, &menos35, []string{"JOÃO BATISTA SILVEIRA", "ANTÔNIO PEREIRA LIMA"}},
		{rh.NormaNR18, "Construção Civil — Turma B", 350, &menos15, []string{"PAULO HENRIQUE COSTA", "RAFAEL AUGUSTO MENDES"}},
		{rh.NormaNR10, "Segurança em Eletricidade — Integração", 100, nil, []string{"MARCOS VINÍCIUS ALVES"}},
	}

	criadas := 0
	for _, tu := range turmas {
		if jaExiste[tu.descricao] {
			continue
		}
		var validadeEm *time.Time
		if tu.validadeHaDias != nil {
			v := haDiasRH(*tu.validadeHaDias)
			validadeEm = &v
		}
		t := &rh.Treinamento{Norma: tu.norma, Descricao: tu.descricao, RealizadoEm: haDiasRH(tu.realizadoHaDias), ValidadeEm: validadeEm}
		if err := repo.Criar(ctx, t); err != nil {
			log.Fatalf("criar treinamento %s: %v", tu.descricao, err)
		}
		for _, nome := range tu.participantes {
			id, ok := idsFuncionarios[nome]
			if !ok {
				log.Fatalf("treinamento %s: funcionário %s não encontrado no seed", tu.descricao, nome)
			}
			if err := repo.AdicionarParticipante(ctx, &rh.TreinamentoParticipante{TreinamentoID: t.ID, FuncionarioID: id}); err != nil {
				log.Fatalf("matricular %s em %s: %v", nome, tu.descricao, err)
			}
		}
		criadas++
	}
	log.Printf("RH: %d turmas de treinamento de exemplo criadas.", criadas)
}

// semearRHUniformes — fixture nova, plano exato em apps/rh/e2e/apoio.go.ts `FIXTURE`.
// Idempotente: pula pela combinação funcionário+peça+motivo.
func semearRHUniformes(ctx context.Context, repo rh.EntregaUniformeRepositorio, idsFuncionarios map[string]string) {
	existentes, err := repo.Listar(ctx)
	if err != nil {
		log.Fatalf("listar entregas de uniforme: %v", err)
	}
	jaExiste := map[string]bool{}
	for _, e := range existentes {
		jaExiste[e.FuncionarioNome+"|"+e.Peca+"|"+e.Motivo] = true
	}

	type entregaExemplo struct {
		funcionario, peca, tamanho, motivo string
	}
	entregas := []entregaExemplo{
		{"PAULO HENRIQUE COSTA", rh.PecaCamisa, "M", rh.MotivoAdmissao},
		{"RAFAEL AUGUSTO MENDES", rh.PecaCalcado, "42", rh.MotivoReposicao},
	}

	criadas := 0
	for _, ex := range entregas {
		if jaExiste[ex.funcionario+"|"+ex.peca+"|"+ex.motivo] {
			continue
		}
		id, ok := idsFuncionarios[ex.funcionario]
		if !ok {
			log.Fatalf("entrega de uniforme: funcionário %s não encontrado no seed", ex.funcionario)
		}
		registradoPor := "Seed"
		e := &rh.EntregaUniforme{
			Peca: ex.peca, Tamanho: ex.tamanho, Quantidade: 1, Motivo: ex.motivo,
			EntregueEm: time.Now().UTC(), RegistradoPor: &registradoPor, FuncionarioID: id,
		}
		if err := repo.Criar(ctx, e); err != nil {
			log.Fatalf("criar entrega de uniforme para %s: %v", ex.funcionario, err)
		}
		criadas++
	}
	log.Printf("RH: %d entregas de uniforme de exemplo criadas.", criadas)
}

func condicional(cond bool, seSim, seNao string) string {
	if cond {
		return seSim
	}
	return seNao
}
