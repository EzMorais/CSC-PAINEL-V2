// Package programacao é a Programação Diária: quem vai pra qual frente de trabalho amanhã,
// com quais veículos/máquinas. Porta de apps/programacao (Next.js) — ver
// https://github.com/EzMorais/CSC-PAINEL. Comentários de campo herdados do schema.prisma
// original explicam o "porquê", não só o "o quê".
package programacao

import (
	"context"
	"time"
)

type StatusProgramacao string

const (
	StatusRascunho  StatusProgramacao = "RASCUNHO"
	StatusPublicada StatusProgramacao = "PUBLICADA"
)

type TipoRecurso string

const (
	RecursoVeiculo TipoRecurso = "VEICULO"
	RecursoMaquina TipoRecurso = "MAQUINA"
	RecursoAviso   TipoRecurso = "AVISO"
)

// Frente é uma frente de trabalho — cada coluna do quadro e da imagem enviada pro grupo.
// Não é a mesma coisa que a Obra do RH/Almoxarifado: ali "obra" é o contrato, aqui é pra
// onde a turma vai amanhã de manhã. GALPÃO e MANUTENÇÃO aparecem no quadro sem serem obra
// de cliente nenhum.
type Frente struct {
	ID         string
	Nome       string
	Cor        string
	Logo       *string
	Ordem      int
	Colunas    int
	ObraCodigo *string
	Ativa      bool
	CriadoEm   time.Time
}

// Funcao é a sigla que aparece depois do nome no quadro: PD, SO, ENG, MOT... Tabela própria
// pra sempre oferecer a mesma lista — texto solto faz a mesma função virar "Tec. Seg.",
// "TST" e "STST" no mesmo dia.
type Funcao struct {
	ID      string
	Sigla   string
	Nome    string
	CargoRH *string
	Ordem   int
	Ativa   bool
	// Cor do grupo desta função — pinta o card no quadro. Editar muda todo mundo que tem
	// essa sigla, não só quem está sendo editado.
	Cor string
}

// Funcionario é o cadastro fixo local de quem não está no RH — a maioria de quem é escalado
// todo dia (o RH tem uma dúzia de pessoas cadastradas, a Programação move mais de cem).
// Complementar ao RH, não duplica quem já vem de lá.
type Funcionario struct {
	ID          string
	Nome        string
	FuncaoSigla *string
	Foto        *string
	Ativo       bool
	// Ausente/de férias hoje — some da lista de disponíveis e não entra em "copiar do dia
	// anterior".
	Ausente    bool
	AusenteObs *string
	Motorista  bool
	// CSC | PRESTADOR
	Tipo     string
	CriadoEm time.Time
}

// Veiculo é o cadastro fixo de veículo/máquina de uso recorrente que não vem da Frota
// (alugado, de terceiro). Complementar à Frota, mesma lógica do Funcionario em relação ao RH.
type Veiculo struct {
	ID            string
	Modelo        string
	Placa         *string
	MotoristaNome *string
	Foto          *string
	Ativo         bool
	CriadoEm      time.Time
}

// Programacao é a programação de um dia — uma linha por data, é assim que "copiar de ontem"
// funciona e que o histórico responde "quem estava na TOYOTA no dia 31?".
type Programacao struct {
	ID           string
	Data         time.Time
	Status       StatusProgramacao
	PublicadaEm  *time.Time
	PublicadaPor *string
	Observacao   *string
	CriadoEm     time.Time
	AtualizadoEm time.Time
	Escalas      []Escala
	Recursos     []Recurso
}

// Escala é uma pessoa numa frente, num dia.
type Escala struct {
	ID                 string
	ProgramacaoID      string
	FrenteID           string
	FuncionarioID      *string // id no RH, quando cadastrado lá
	FuncionarioLocalID *string // id em Funcionario, quando cadastrado aqui — nunca os dois
	// Cópia do nome: o print de um dia passado tem que continuar dizendo o que dizia, mesmo
	// que a pessoa saia do RH ou do cadastro local depois.
	Nome        string
	FuncaoSigla *string
	Ordem       int
	Observacao  *string
}

// Recurso é veículo, máquina ou aviso no pé de uma frente — os três juntos porque na
// imagem ocupam a mesma faixa e o usuário os trata igual.
type Recurso struct {
	ID             string
	ProgramacaoID  string
	FrenteID       string
	Tipo           TipoRecurso
	Placa          *string
	Descricao      string
	MotoristaNome  *string
	Destaque       bool
	VeiculoLocalID *string
	Ordem          int
}

type DiaListado struct {
	ID      string
	Data    time.Time
	Status  StatusProgramacao
	Escalas int
}

type Repositorio interface {
	// Frentes
	ListarFrentes(ctx context.Context, ativas bool) ([]Frente, error)
	BuscarFrente(ctx context.Context, id string) (*Frente, error)
	CriarFrente(ctx context.Context, f *Frente) error
	AtualizarFrente(ctx context.Context, f *Frente) error
	AlternarFrente(ctx context.Context, id string, ativa bool) error
	ApagarFrente(ctx context.Context, id string) error
	ContarUsosFrente(ctx context.Context, id string) (int, error)
	ReordenarFrentes(ctx context.Context, idA string, ordemA int, idB string, ordemB int) error

	// Funções
	ListarFuncoes(ctx context.Context, ativas bool) ([]Funcao, error)
	CriarFuncao(ctx context.Context, f *Funcao) error
	AtualizarFuncao(ctx context.Context, f *Funcao) error
	AlternarFuncao(ctx context.Context, id string, ativa bool) error

	// Funcionários (cadastro local)
	ListarFuncionarios(ctx context.Context, somenteAtivos bool) ([]Funcionario, error)
	BuscarFuncionario(ctx context.Context, id string) (*Funcionario, error)
	BuscarFuncionarios(ctx context.Context, ids []string) ([]Funcionario, error)
	CriarFuncionario(ctx context.Context, f *Funcionario) error
	AtualizarFuncionario(ctx context.Context, f *Funcionario) error
	AlternarFuncionarioAtivo(ctx context.Context, id string, ativo bool) error
	AlternarFuncionarioAusente(ctx context.Context, id string, ausente bool, obs *string) error

	// Veículos (cadastro local)
	ListarVeiculos(ctx context.Context, somenteAtivos bool) ([]Veiculo, error)
	CriarVeiculo(ctx context.Context, v *Veiculo) error
	AtualizarVeiculo(ctx context.Context, v *Veiculo) error
	AlternarVeiculoAtivo(ctx context.Context, id string, ativo bool) error

	// Programação do dia
	ProgramacaoDoDia(ctx context.Context, data time.Time) (*Programacao, error)
	UltimaProgramacaoAntesDe(ctx context.Context, data time.Time) (*Programacao, error)
	DiasRecentes(ctx context.Context, limite int) ([]DiaListado, error)
	CriarOuObterDia(ctx context.Context, data time.Time) (*Programacao, error)
	Publicar(ctx context.Context, data time.Time, publicadaPor string) error
	SubstituirDia(ctx context.Context, programacaoID string, escalas []Escala, recursos []Recurso) error

	// Escalas
	UltimaOrdemEscala(ctx context.Context, programacaoID, frenteID string) (int, error)
	CriarEscala(ctx context.Context, e *Escala) error
	BuscarEscala(ctx context.Context, id string) (*Escala, time.Time, error) // devolve também a data do dia
	BuscarEscalaPorNomeNaFrente(ctx context.Context, programacaoID, frenteID, nome string) (*Escala, error)
	MoverEscala(ctx context.Context, id, frenteID string, ordem int) error
	TirarEscala(ctx context.Context, id string) error
	TrocarFuncaoEscala(ctx context.Context, id string, funcaoSigla *string) error

	// Recursos
	UltimaOrdemRecurso(ctx context.Context, programacaoID, frenteID string) (int, error)
	CriarRecurso(ctx context.Context, r *Recurso) error
	BuscarRecurso(ctx context.Context, id string) (*Recurso, time.Time, error)
	TirarRecurso(ctx context.Context, id string) error
}
