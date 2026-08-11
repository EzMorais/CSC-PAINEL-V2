package rh

import "time"

// Status — campo GRAVADO, não derivado (COMPORTAMENTO.md §2).
const (
	StatusAtivo     = "ATIVO"
	StatusAfastado  = "AFASTADO"
	StatusFerias    = "FERIAS"
	StatusDesligado = "DESLIGADO"
)

var RotuloStatus = map[string]string{
	StatusAtivo: "Ativo", StatusAfastado: "Afastado", StatusFerias: "Férias", StatusDesligado: "Desligado",
}

// Tipo de Evento da timeline — o valor gravado é a chave, o rótulo é só exibição.
const (
	EventoAdmissao     = "ADMISSAO"
	EventoMudancaCargo = "MUDANCA_CARGO"
	EventoMudancaObra  = "MUDANCA_OBRA"
	EventoAfastamento  = "AFASTAMENTO"
	EventoRetorno      = "RETORNO"
	EventoFerias       = "FERIAS"
	EventoAdvertencia  = "ADVERTENCIA"
	EventoPromocao     = "PROMOCAO"
	EventoDesligamento = "DESLIGAMENTO"
	EventoObservacao   = "OBSERVACAO"
)

// TipoEventoPorStatus mapeia a MUDANÇA de status pro tipo de evento gerado automaticamente
// — COMPORTAMENTO.md §3, mesma tabela de actions/funcionarios.ts `TIPO_POR_STATUS`.
var TipoEventoPorStatus = map[string]string{
	StatusAtivo: EventoRetorno, StatusAfastado: EventoAfastamento,
	StatusFerias: EventoFerias, StatusDesligado: EventoDesligamento,
}

// Funcionario é a entidade central do módulo — ver COMPORTAMENTO.md §2.
type Funcionario struct {
	ID        string
	Matricula string
	Nome      string
	CPF       string

	RG             *string
	DataNascimento *time.Time
	Sexo           *string
	EstadoCivil    *string
	NomeMae        *string
	Foto           *string // data: URI — ver COMPORTAMENTO.md §2.

	Telefone *string
	Email    *string

	CEP         *string
	Logradouro  *string
	Numero      *string
	Complemento *string
	Bairro      *string
	Cidade      *string
	UF          *string

	Status       string
	AdmitidoEm   time.Time
	DemitidoEm   *time.Time
	MotivoSaida  *string
	Salario      *float64
	TipoContrato string

	Banco     *string
	Agencia   *string
	Conta     *string
	TipoConta *string
	ChavePix  *string

	TamanhoCamisa  *string
	TamanhoCalca   *string
	TamanhoCalcado *string

	Observacoes *string
	NivelObra   *string

	CriadoEm time.Time

	ObraID         *string
	CargoID        *string
	DepartamentoID *string
}

type Dependente struct {
	ID             string
	Nome           string
	Parentesco     string // FILHO | CONJUGE | OUTRO
	DataNascimento *time.Time
	CPF            *string
	IRRF           bool
	SalarioFamilia bool
	FuncionarioID  string
}

// Evento é a timeline append-only — "fonte da verdade" do histórico (COMPORTAMENTO.md §3).
// OcorridoEm é quando aconteceu de fato; RegistradoEm é quando foi digitado (pode ser
// depois). Nunca editado/apagado quando o cadastro muda.
type Evento struct {
	ID              string
	Tipo            string
	DescricaoHumana string
	Detalhe         *string
	OcorridoEm      time.Time
	RegistradoEm    time.Time
	RegistradoPor   *string
	FuncionarioID   string
	ObraID          *string
}

// VinculosFuncionario — o que está pendurado no funcionário, conferido antes de excluir
// (COMPORTAMENTO.md §4). Eventos e Dependentes ficam de fora do "Total" de propósito: são
// gerados pelo próprio sistema/família, não são prova legal.
type VinculosFuncionario struct {
	EntregasEpi      int
	EntregasUniforme int
	Exames           int
	Treinamentos     int
	Documentos       int
	Eventos          int
	Dependentes      int
}

func (v VinculosFuncionario) Total() int {
	return v.EntregasEpi + v.EntregasUniforme + v.Exames + v.Treinamentos + v.Documentos
}
