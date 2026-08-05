// Package painel contém as entidades e regras de negócio do módulo Painel de Locação.
// Não importa banco de dados nem HTTP — ver ARQUITETURA.md §1.
package painel

import (
	"time"

	"siqueiracampos/servidor/internal/domain/cadastro"
)

type Status string

const (
	StatusAtiva     Status = "ATIVA"
	StatusAtencao   Status = "ATENCAO"
	StatusVencida   Status = "VENCIDA"
	StatusDevolvida Status = "DEVOLVIDA"
	StatusSemPrazo  Status = "SEM_PRAZO"
)

var RotuloStatus = map[Status]string{
	StatusAtiva:     "Ativa",
	StatusAtencao:   "Atenção",
	StatusVencida:   "Vencida",
	StatusDevolvida: "Devolvida",
	StatusSemPrazo:  "Sem prazo",
}

type Estado string

const (
	EstadoOK         Estado = "OK"
	EstadoPerdido    Estado = "PERDIDO"
	EstadoDanificado Estado = "DANIFICADO"
)

type TipoMovimentacao string

const (
	MovRegistro        TipoMovimentacao = "REGISTRO"
	MovEdicao          TipoMovimentacao = "EDICAO"
	MovRenovacao       TipoMovimentacao = "RENOVACAO"
	MovTransferencia   TipoMovimentacao = "TRANSFERENCIA"
	MovDevolucao       TipoMovimentacao = "DEVOLUCAO"
	MovImportacao      TipoMovimentacao = "IMPORTACAO"
	MovReclassificacao TipoMovimentacao = "RECLASSIFICACAO"
)

// DiasAtencao é o limiar de ATENÇÃO em dias — definido pela legenda da planilha de origem.
const DiasAtencao = 7

type Periodo struct {
	Rotulo string
	Dias   int
}

// Periodos alimenta o seletor "período rápido" do formulário — ver COMPORTAMENTO.md §3.3.
var Periodos = []Periodo{
	{"Diário (1 dia)", 1},
	{"Semanal (7 dias)", 7},
	{"Quinzenal (15 dias)", 15},
	{"Mensal (30 dias)", 30},
	{"Trimestre (90 dias)", 90},
}

// Obra e Fornecedor são tabelas COMPARTILHADAS entre módulos — ver
// internal/domain/cadastro. O Painel foi o primeiro módulo e mantém estes aliases pra não
// obrigar handlers/templates/repositórios já escritos a trocar de nome de pacote.
type Obra = cadastro.Obra
type Fornecedor = cadastro.Fornecedor

type Movimentacao struct {
	ID              string
	Tipo            TipoMovimentacao
	DescricaoHumana string
	PayloadAntes    *string
	PayloadDepois   *string
	CriadoEm        time.Time
}

type Locacao struct {
	ID                string
	Descricao         string
	TrCodigo          *string
	Quantidade        int
	Estado            Estado
	Observacoes       *string
	DataInicio        *time.Time
	DataFim           *time.Time
	ValorItem         *float64
	DevolvidaEm       *time.Time
	ObraAConfirmar    bool
	PossivelDuplicata bool
	NumeroOrigem      *string
	CriadoEm          time.Time
	AtualizadoEm      time.Time

	ObraID       string
	FornecedorID *string

	// Preenchidos quando a consulta faz join — não são colunas da tabela.
	ObraCodigo     string
	ObraCliente    string
	FornecedorNome *string
	Movimentacoes  []Movimentacao
}
