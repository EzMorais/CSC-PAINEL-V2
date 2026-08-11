package rh

import (
	"bytes"
	"context"
	"io"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

// planilhaTeste monta um .xlsx em memória com o cabeçalho reconhecido pelo parser (nome/cpf
// no mínimo) — mesma ideia da fixture usada pela suíte Playwright Go
// (apps/rh/e2e/fixtures/importacao-funcionarios.xlsx), só que gerada por código pra não
// depender de arquivo externo no teste unitário.
func planilhaTeste(t *testing.T, linhas [][]string) io.Reader {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", "Funcionários")

	cabecalho := []any{"Nome", "CPF", "Admissão", "Cargo", "Obra"}
	if err := f.SetSheetRow("Funcionários", "A1", &cabecalho); err != nil {
		t.Fatal(err)
	}
	for i, linha := range linhas {
		row := make([]any, len(linha))
		for j, v := range linha {
			row[j] = v
		}
		cel, _ := excelize.CoordinatesToCellName(1, i+2)
		if err := f.SetSheetRow("Funcionários", cel, &row); err != nil {
			t.Fatal(err)
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(buf.Bytes())
}

type obraTeste struct{ id, codigo, descricao string }

func novoGerenciadorImportacao(obras []obraTeste, criarObraChamadas *int) (*GerenciadorImportacao, *funcionariosFake, *cargosFake) {
	fu := novoFuncionariosFake()
	ca := novoCargosFake()
	g := &GerenciadorImportacao{
		Funcionarios: fu, Cargos: ca,
		ListarObras: func(ctx context.Context) ([]OpcaoObraImportacao, error) {
			r := make([]OpcaoObraImportacao, len(obras))
			for i, o := range obras {
				r[i] = OpcaoObraImportacao{ID: o.id, Codigo: o.codigo, Descricao: o.descricao}
			}
			return r, nil
		},
		CriarObra: func(ctx context.Context, cliente, codigo, descricao string) (string, error) {
			if criarObraChamadas != nil {
				*criarObraChamadas++
			}
			return "obra-nova-" + codigo, nil
		},
	}
	return g, fu, ca
}

func TestGerarPrevia_NaoGravaNada(t *testing.T) {
	g, fu, ca := novoGerenciadorImportacao(nil, nil)
	planilha := planilhaTeste(t, [][]string{
		{"NOVO FUNCIONARIO TESTE", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"},
	})

	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if previa.Novos != 1 || previa.JaExistem != 0 {
		t.Fatalf("esperava 1 novo e 0 já existentes, veio Novos=%d JaExistem=%d", previa.Novos, previa.JaExistem)
	}
	if len(previa.CargosNovos) != 1 || previa.CargosNovos[0] != "Pintor" {
		t.Errorf("esperava cargo novo 'Pintor', veio %v", previa.CargosNovos)
	}
	if len(previa.ObrasNovas) != 1 || previa.ObrasNovas[0] != "EX-9999-26" {
		t.Errorf("esperava obra nova 'EX-9999-26', veio %v", previa.ObrasNovas)
	}
	if previa.Token == "" {
		t.Error("esperava um token de prévia")
	}
	if len(fu.criados) != 0 || len(ca.criados) != 0 {
		t.Fatal("GerarPrevia não pode gravar nada — nem funcionário nem cargo")
	}
}

func TestGerarPrevia_CPFJaExistente_MarcaComoJaExiste(t *testing.T) {
	g, fu, _ := novoGerenciadorImportacao(nil, nil)
	fu.adicionarExistente(&dominio.Funcionario{ID: "f1", CPF: "12345678909", Nome: "Já Cadastrado"})

	planilha := planilhaTeste(t, [][]string{
		{"JA CADASTRADO", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"},
	})
	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if previa.Novos != 0 || previa.JaExistem != 1 {
		t.Fatalf("esperava 0 novos e 1 já existente, veio Novos=%d JaExistem=%d", previa.Novos, previa.JaExistem)
	}
	// Cargo/obra de uma linha JA_EXISTE não deveriam entrar nas listas "será criado" — só
	// linhas NOVAS geram criação (importacao.go: "if !jaExiste && criaCargo...").
	if len(previa.CargosNovos) != 0 || len(previa.ObrasNovas) != 0 {
		t.Errorf("linha já existente não deveria propor criar cargo/obra: %+v / %+v", previa.CargosNovos, previa.ObrasNovas)
	}
}

func TestConfirmar_CriaFuncionarioCargoEObra(t *testing.T) {
	chamadasCriarObra := 0
	g, fu, ca := novoGerenciadorImportacao(nil, &chamadasCriarObra)
	planilha := planilhaTeste(t, [][]string{
		{"NOVO FUNCIONARIO TESTE", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"},
	})

	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}

	resumo, err := g.Confirmar(context.Background(), previa.Token, "Admin Teste")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resumo.Criados != 1 || resumo.CargosCriados != 1 || resumo.ObrasCriadas != 1 {
		t.Fatalf("resumo não confere: %+v", resumo)
	}
	if len(fu.criados) != 1 || fu.criados[0].Nome != "NOVO FUNCIONARIO TESTE" {
		t.Fatalf("funcionário não foi gravado como esperado: %+v", fu.criados)
	}
	if len(ca.criados) != 1 || ca.criados[0].Nome != "Pintor" {
		t.Fatalf("cargo não foi criado como esperado: %+v", ca.criados)
	}
	if chamadasCriarObra != 1 {
		t.Fatalf("esperava CriarObra chamado 1 vez, veio %d", chamadasCriarObra)
	}
	if len(fu.eventosCriados) != 1 || fu.eventosCriados[0].Tipo != dominio.EventoAdmissao {
		t.Fatalf("esperava evento de ADMISSAO gravado junto, veio %+v", fu.eventosCriados)
	}
}

// TestConfirmar_ObraJaCadastrada_NaoCriaDeNovo prova que uma obra já existente (encontrada
// via ListarObras) nunca é recriada — só o cadastro compartilhado é referenciado por FK.
func TestConfirmar_ObraJaCadastrada_NaoCriaDeNovo(t *testing.T) {
	chamadasCriarObra := 0
	g, _, _ := novoGerenciadorImportacao([]obraTeste{{id: "obra-1", codigo: "EX-9999-26", descricao: "EX-9999-26"}}, &chamadasCriarObra)
	planilha := planilhaTeste(t, [][]string{
		{"NOVO FUNCIONARIO TESTE", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"},
	})

	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}
	if len(previa.ObrasNovas) != 0 {
		t.Fatalf("obra já cadastrada não deveria aparecer como nova: %v", previa.ObrasNovas)
	}

	resumo, err := g.Confirmar(context.Background(), previa.Token, "Admin")
	if err != nil {
		t.Fatal(err)
	}
	if resumo.ObrasCriadas != 0 || chamadasCriarObra != 0 {
		t.Fatalf("não deveria ter criado obra nova — já existia (obras=%d, chamadas=%d)", resumo.ObrasCriadas, chamadasCriarObra)
	}
}

// TestConfirmar_PulaCPFQueJaExiste — a linha da planilha cujo CPF já está no RH nunca é
// gravada, mesmo que a planilha traga dado diferente (COMPORTAMENTO.md §5: "sempre pulado").
func TestConfirmar_PulaCPFQueJaExiste(t *testing.T) {
	g, fu, _ := novoGerenciadorImportacao(nil, nil)
	fu.adicionarExistente(&dominio.Funcionario{ID: "f1", CPF: "12345678909", Nome: "Nome Antigo"})

	planilha := planilhaTeste(t, [][]string{
		{"NOME NOVO DA PLANILHA", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"}, // CPF já existe
		{"PESSOA REALMENTE NOVA", "529.982.247-25", "15/01/2026", "Pedreiro", "EX-1001-25"},
	})
	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}
	if previa.Novos != 1 || previa.JaExistem != 1 {
		t.Fatalf("esperava 1 novo e 1 já existente, veio Novos=%d JaExistem=%d", previa.Novos, previa.JaExistem)
	}

	resumo, err := g.Confirmar(context.Background(), previa.Token, "Admin")
	if err != nil {
		t.Fatal(err)
	}
	if resumo.Criados != 1 {
		t.Fatalf("esperava só 1 criado (o CPF duplicado é pulado), veio %d", resumo.Criados)
	}
	if fu.porCPF["12345678909"].Nome != "Nome Antigo" {
		t.Fatal("funcionário já existente não pode ser sobrescrito por um reimport")
	}
}

func TestConfirmar_TokenInexistenteOuJaUsado(t *testing.T) {
	g, _, _ := novoGerenciadorImportacao(nil, nil)

	if _, err := g.Confirmar(context.Background(), "token-que-nunca-existiu", "Admin"); err == nil {
		t.Fatal("esperava erro para token inexistente")
	}

	planilha := planilhaTeste(t, [][]string{{"NOVO FUNCIONARIO TESTE", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"}})
	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := g.Confirmar(context.Background(), previa.Token, "Admin"); err != nil {
		t.Fatalf("primeira confirmação deveria ter sucesso: %v", err)
	}
	// Segunda confirmação do MESMO token — a prévia é de uso único (importacao.go, comentário
	// de Confirmar): reenviar não pode duplicar o funcionário nem "funcionar de novo".
	if _, err := g.Confirmar(context.Background(), previa.Token, "Admin"); err == nil {
		t.Fatal("esperava erro ao reusar um token já confirmado")
	}
}

func TestConfirmar_TokenExpirado(t *testing.T) {
	g, _, _ := novoGerenciadorImportacao(nil, nil)
	planilha := planilhaTeste(t, [][]string{{"NOVO FUNCIONARIO TESTE", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"}})
	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}

	// Força a expiração manipulando o cache diretamente — mais direto que esperar 15 minutos.
	g.mu.Lock()
	entrada := g.cache[previa.Token]
	entrada.expiraEm = time.Now().Add(-time.Second)
	g.cache[previa.Token] = entrada
	g.mu.Unlock()

	if _, err := g.Confirmar(context.Background(), previa.Token, "Admin"); err == nil {
		t.Fatal("esperava erro para token expirado")
	}
}

func TestConfirmar_NenhumFuncionarioNovo(t *testing.T) {
	g, fu, _ := novoGerenciadorImportacao(nil, nil)
	fu.adicionarExistente(&dominio.Funcionario{ID: "f1", CPF: "12345678909", Nome: "Já Cadastrado"})

	planilha := planilhaTeste(t, [][]string{{"JA CADASTRADO", "123.456.789-09", "15/01/2026", "Pintor", "EX-9999-26"}})
	previa, err := g.GerarPrevia(context.Background(), planilha)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := g.Confirmar(context.Background(), previa.Token, "Admin"); err == nil {
		t.Fatal("esperava erro: nenhum funcionário novo na planilha")
	}
}

func TestGerarPrevia_PlanilhaSemColunasReconhecidas_Erro(t *testing.T) {
	g, _, _ := novoGerenciadorImportacao(nil, nil)
	f := excelize.NewFile()
	defer f.Close()
	cab := []any{"Coluna A", "Coluna B"}
	_ = f.SetSheetRow("Sheet1", "A1", &cab)
	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}

	_, err = g.GerarPrevia(context.Background(), bytes.NewReader(buf.Bytes()))
	if err == nil {
		t.Fatal("esperava erro: planilha sem colunas Nome/CPF reconhecíveis")
	}
}
