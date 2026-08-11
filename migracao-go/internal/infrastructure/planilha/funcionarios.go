// Leitura da planilha de funcionários do RH — ver migracao-go/rh/COMPORTAMENTO.md §5.
// Espelha apps/rh/src/lib/planilha/funcionarios.ts: cabeçalho reconhecido por APELIDO (não
// por posição fixa), diferente do parser do Painel de Locação neste mesmo pacote.
package planilha

import (
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

var apelidosFuncionario = map[string][]string{
	"nome": {"nome", "nome completo", "funcionario", "colaborador"},
	// "c p f" e "cpf mf" são "C.P.F"/"CPF/MF" já normalizados — NormalizarCabecalho troca
	// pontuação por espaço, então o apelido precisa estar na forma pós-normalização.
	"cpf":            {"cpf", "c p f", "cpf mf"},
	"matricula":      {"matricula", "registro", "chapa"},
	"rg":             {"rg", "identidade"},
	"dataNascimento": {"data de nascimento", "nascimento", "dt nascimento", "data nascimento"},
	"admitidoEm":     {"admissao", "data de admissao", "dt admissao", "admitido em"},
	"cargo":          {"cargo", "funcao"},
	"obra":           {"obra", "centro de custo", "lotacao"},
	"telefone":       {"telefone", "celular", "fone", "contato"},
	"email":          {"email", "e mail"},
	"status":         {"status", "situacao"},
	"sexo":           {"sexo", "genero"},
	"salario":        {"salario"},
	"tipoContrato":   {"tipo de contrato", "contrato", "regime"},
	"cidade":         {"cidade", "municipio"},
	"uf":             {"uf", "estado"},
	"tamanhoCamisa":  {"camisa", "tamanho camisa", "tam camisa"},
	"tamanhoCalca":   {"calca", "tamanho calca", "tam calca"},
	"tamanhoCalcado": {"calcado", "bota", "tamanho calcado", "tam calcado"},
}

var statusAceitosFuncionario = map[string]string{
	"ativo": dominio.StatusAtivo, "afastado": dominio.StatusAfastado, "ferias": dominio.StatusFerias,
	"desligado": dominio.StatusDesligado, "demitido": dominio.StatusDesligado, "inativo": dominio.StatusDesligado,
}

type LinhaFuncionarioImportado struct {
	Linha                                       int
	Nome, CPF                                   string
	Matricula                                   *string
	AdmitidoEm                                  *time.Time
	Cargo, Obra                                 *string
	Status                                      string
	RG                                          *string
	DataNascimento                              *time.Time
	Telefone, Email, Sexo                       *string
	Salario                                     *float64
	TipoContrato, Cidade, UF                    *string
	TamanhoCamisa, TamanhoCalca, TamanhoCalcado *string
}

type LinhaFuncionarioIgnorada struct {
	Linha    int
	Motivo   string
	Conteudo string
}

type LeituraFuncionarios struct {
	Linhas              []LinhaFuncionarioImportado
	Ignoradas           []LinhaFuncionarioIgnorada
	ColunasReconhecidas []string
	ColunasIgnoradas    []string
}

func vazio(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// LerPlanilhaFuncionarios lê diretamente do upload (io.Reader) — nunca grava em disco, é a
// própria decisão de segurança documentada em COMPORTAMENTO.md §5.
func LerPlanilhaFuncionarios(r io.Reader) (*LeituraFuncionarios, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	folhas := f.GetSheetList()
	if len(folhas) == 0 {
		return nil, errPlanilhaVazia
	}
	sheet := folhas[0]

	linhasBrutas, err := f.GetRows(sheet)
	if err != nil {
		return nil, err
	}
	totalLinhas := len(linhasBrutas)

	// O cabeçalho nem sempre é a primeira linha: procura nas primeiras dez a que tem "nome"
	// e "cpf" entre os apelidos reconhecidos.
	linhaCabecalho := 0
	posicaoDaColuna := map[string]int{}

	limite := totalLinhas
	if limite > 10 {
		limite = 10
	}
	for i := 1; i <= limite; i++ {
		candidatas := map[string]int{}
		for col, valor := range linhasBrutas[i-1] {
			t := dominio.NormalizarCabecalho(valor)
			if t == "" {
				continue
			}
			for campo, apelidos := range apelidosFuncionario {
				if _, ja := candidatas[campo]; ja {
					continue
				}
				for _, a := range apelidos {
					if a == t {
						candidatas[campo] = col + 1 // 1-based, mesma convenção do excelize
						break
					}
				}
			}
		}
		if _, temNome := candidatas["nome"]; temNome {
			if _, temCPF := candidatas["cpf"]; temCPF {
				linhaCabecalho = i
				posicaoDaColuna = candidatas
				break
			}
		}
	}

	if linhaCabecalho == 0 {
		return nil, errCabecalhoNaoEncontrado
	}

	colunasReconhecidas := make([]string, 0, len(posicaoDaColuna))
	for campo := range posicaoDaColuna {
		colunasReconhecidas = append(colunasReconhecidas, campo)
	}

	posicoesUsadas := map[int]bool{}
	for _, col := range posicaoDaColuna {
		posicoesUsadas[col] = true
	}
	var colunasIgnoradas []string
	for col, valor := range linhasBrutas[linhaCabecalho-1] {
		v := strings.TrimSpace(valor)
		if v != "" && !posicoesUsadas[col+1] {
			colunasIgnoradas = append(colunasIgnoradas, v)
		}
	}

	ler := func(row []string, campo string) string {
		col, ok := posicaoDaColuna[campo]
		if !ok || col-1 >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[col-1])
	}

	lerData := func(row []string, campo string, numeroLinha int) *time.Time {
		col, ok := posicaoDaColuna[campo]
		if !ok {
			return nil
		}
		return celulaData(f, sheet, col, numeroLinha)
	}

	var linhas []LinhaFuncionarioImportado
	var ignoradas []LinhaFuncionarioIgnorada
	cpfsVistos := map[string]bool{}

	for i := linhaCabecalho + 1; i <= totalLinhas; i++ {
		row := linhasBrutas[i-1]
		nome := ler(row, "nome")
		cpfBruto := ler(row, "cpf")

		if nome == "" && cpfBruto == "" {
			continue // linha em branco: separador, não erro
		}

		resumo := semTraco(nome) + " / " + semTraco(cpfBruto)

		if len(nome) < 3 {
			ignoradas = append(ignoradas, LinhaFuncionarioIgnorada{Linha: i, Motivo: "sem nome", Conteudo: resumo})
			continue
		}

		cpf := dominio.ApenasDigitos(cpfBruto)
		if cpf == "" {
			ignoradas = append(ignoradas, LinhaFuncionarioIgnorada{Linha: i, Motivo: "sem CPF", Conteudo: resumo})
			continue
		}
		if !dominio.CPFValido(cpf) {
			ignoradas = append(ignoradas, LinhaFuncionarioIgnorada{Linha: i, Motivo: "CPF inválido", Conteudo: resumo})
			continue
		}
		if cpfsVistos[cpf] {
			ignoradas = append(ignoradas, LinhaFuncionarioIgnorada{Linha: i, Motivo: "CPF repetido na própria planilha", Conteudo: resumo})
			continue
		}
		cpfsVistos[cpf] = true

		statusBruto := dominio.NormalizarChave(ler(row, "status"))
		status, ok := statusAceitosFuncionario[statusBruto]
		if !ok {
			status = dominio.StatusAtivo
		}

		linhas = append(linhas, LinhaFuncionarioImportado{
			Linha: i, Nome: nome, CPF: cpf,
			Matricula:      vazio(ler(row, "matricula")),
			AdmitidoEm:     lerData(row, "admitidoEm", i),
			Cargo:          vazio(ler(row, "cargo")),
			Obra:           vazio(ler(row, "obra")),
			Status:         status,
			RG:             vazio(ler(row, "rg")),
			DataNascimento: lerData(row, "dataNascimento", i),
			Telefone:       vazio(ler(row, "telefone")),
			Email:          vazio(ler(row, "email")),
			Sexo:           vazio(ler(row, "sexo")),
			Salario:        celulaNumero(ler(row, "salario")),
			TipoContrato:   vazio(ler(row, "tipoContrato")),
			Cidade:         vazio(ler(row, "cidade")),
			UF:             vazio(ler(row, "uf")),
			TamanhoCamisa:  vazio(ler(row, "tamanhoCamisa")),
			TamanhoCalca:   vazio(ler(row, "tamanhoCalca")),
			TamanhoCalcado: vazio(ler(row, "tamanhoCalcado")),
		})
	}

	return &LeituraFuncionarios{
		Linhas: linhas, Ignoradas: ignoradas,
		ColunasReconhecidas: colunasReconhecidas, ColunasIgnoradas: colunasIgnoradas,
	}, nil
}

func semTraco(s string) string {
	if s == "" {
		return "—"
	}
	return s
}

var (
	errPlanilhaVazia          = planilhaErro("A planilha está vazia.")
	errCabecalhoNaoEncontrado = planilhaErro("Não encontrei as colunas \"Nome\" e \"CPF\" nas primeiras linhas. Confira se a planilha tem uma linha de cabeçalho com esses nomes.")
)

type planilhaErro string

func (e planilhaErro) Error() string { return string(e) }

// celulaData lê o valor BRUTO da célula (serial do Excel) quando é data de verdade, com
// fallback pra texto BR/ISO — a planilha de RH mistura os dois formatos na mesma coluna
// porque parte foi digitada à mão (mesmo motivo do comentário em paraData de funcionarios.ts).
func celulaData(f *excelize.File, sheet string, col, linha int) *time.Time {
	ref, _ := excelize.CoordinatesToCellName(col, linha)
	bruto, err := f.GetCellValue(sheet, ref, excelize.Options{RawCellValue: true})
	if err == nil && bruto != "" {
		if serial, err := strconv.ParseFloat(bruto, 64); err == nil {
			if t, err := excelize.ExcelDateToTime(serial, false); err == nil {
				t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
				return &t
			}
		}
	}

	formatado, err := f.GetCellValue(sheet, ref)
	if err != nil {
		return nil
	}
	return parseDataTexto(formatado)
}

func parseDataTexto(texto string) *time.Time {
	texto = strings.TrimSpace(texto)
	if texto == "" {
		return nil
	}

	if t := parseDataBR(texto); t != nil {
		return t
	}
	if len(texto) >= 10 {
		if t, err := time.Parse("2006-01-02", texto[:10]); err == nil {
			return &t
		}
	}
	return nil
}

func parseDataBR(texto string) *time.Time {
	separador := ""
	for _, s := range []string{"/", "-", "."} {
		if strings.Contains(texto, s) {
			separador = s
			break
		}
	}
	if separador == "" {
		return nil
	}
	partes := strings.Split(texto, separador)
	if len(partes) != 3 {
		return nil
	}
	dia, err1 := strconv.Atoi(partes[0])
	mes, err2 := strconv.Atoi(partes[1])
	ano, err3 := strconv.Atoi(partes[2])
	if err1 != nil || err2 != nil || err3 != nil {
		return nil
	}
	if ano < 100 {
		ano += 2000
	}
	if mes < 1 || mes > 12 || dia < 1 || dia > 31 {
		return nil
	}
	t := time.Date(ano, time.Month(mes), dia, 0, 0, 0, 0, time.UTC)
	return &t
}

func celulaNumero(texto string) *float64 {
	texto = strings.TrimSpace(texto)
	if texto == "" {
		return nil
	}
	limpo := strings.NewReplacer("R$", "", " ", "", ".", "", ",", ".").Replace(texto)
	n, err := strconv.ParseFloat(limpo, 64)
	if err != nil {
		return nil
	}
	return &n
}
