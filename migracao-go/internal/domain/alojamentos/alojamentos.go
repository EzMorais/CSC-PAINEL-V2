package alojamentos

import (
	"context"
	"time"
)

const (
	AlocacaoAtiva     = "ATIVA"
	AlocacaoEncerrada = "ENCERRADA"
	PedidoAberto      = "ABERTO"
	PedidoAndamento   = "EM_ANDAMENTO"
	PedidoAtendido    = "ATENDIDO"
	PedidoCancelado   = "CANCELADO"
)

type Alojamento struct {
	ID, Nome                                                                 string
	CEP, Logradouro, Numero, Complemento, Bairro, Cidade, UF                 *string
	Lat, Lng                                                                 *float64
	CapacidadeTotal                                                          *int
	ResponsavelNome, TelefoneResponsavel, GrupoWhatsappID, Foto, Observacoes *string
	Ativo                                                                    bool
	CriadoEm, AtualizadoEm                                                   time.Time
	Quartos                                                                  []Quarto
	Ocupacao                                                                 int
}
type Quarto struct {
	ID, AlojamentoID, Numero string
	Capacidade               int
	Tipo, Observacoes        *string
	Ativo                    bool
	Ocupacao                 int
	CriadoEm                 time.Time
}
type Rota struct {
	ID, Nome                                                             string
	Motorista, Veiculo, HorarioIda, HorarioVolta, ObraCodigo, Observacao *string
	Capacidade                                                           *int
	Ativo                                                                bool
	CriadoEm, AtualizadoEm                                               time.Time
}
type Alocacao struct {
	ID, FuncionarioID, FuncionarioNome, FuncionarioMatricula, AlojamentoID, Status, TransporteTipo         string
	ObraCodigo, QuartoID, ObraID, MotivoSaida, CaronaComNome, RotaID, Telefone, Observacoes, RegistradoPor *string
	AlojamentoNome, QuartoNumero, RotaNome                                                                 string
	DataEntrada                                                                                            time.Time
	DataSaida                                                                                              *time.Time
	CriadoEm, AtualizadoEm                                                                                 time.Time
}
type Pedido struct {
	ID, AlojamentoID, AlojamentoNome, Tipo, Titulo, Status, Prioridade, Origem                                                        string
	Descricao, AlocacaoID, FuncionarioNome, AtendidoPor, RespostaObservacao, TelefoneOrigem, GrupoOrigemID, NomeOrigem, RegistradoPor *string
	AtendidoEm                                                                                                                        *time.Time
	CriadoEm, AtualizadoEm                                                                                                            time.Time
}
type Programacao struct {
	ID, Tipo, Titulo                                                             string
	AlojamentoID, AlojamentoNome, Descricao, Horario, ResponsavelNome, CriadoPor *string
	Data, CriadoEm, AtualizadoEm                                                 time.Time
}
type Indicadores struct{ AlojamentosAtivos, Moradores, Vagas, PedidosAbertos int }

type Repositorio interface {
	Indicadores(context.Context) (Indicadores, error)
	ListarAlojamentos(context.Context, bool) ([]Alojamento, error)
	BuscarAlojamento(context.Context, string) (*Alojamento, error)
	CriarAlojamento(context.Context, *Alojamento) error
	AtualizarAlojamento(context.Context, *Alojamento) error
	AlternarAlojamento(context.Context, string, bool) error
	VincularGrupo(context.Context, string, *string) error
	CriarQuarto(context.Context, *Quarto) error
	AlternarQuarto(context.Context, string, bool) error
	ListarRotas(context.Context, bool) ([]Rota, error)
	CriarRota(context.Context, *Rota) error
	AlternarRota(context.Context, string, bool) error
	ListarAlocacoes(context.Context, string) ([]Alocacao, error)
	BuscarAlocacaoAtivaDoFuncionario(context.Context, string) (*Alocacao, error)
	OcupacaoQuarto(context.Context, string) (int, error)
	CriarAlocacao(context.Context, *Alocacao) error
	EncerrarAlocacao(context.Context, string, time.Time, *string) error
	AtualizarTelefone(context.Context, string, *string) error
	ListarPedidos(context.Context, string) ([]Pedido, error)
	CriarPedido(context.Context, *Pedido) error
	AtualizarPedido(context.Context, string, string, *string, string, *time.Time) error
	ListarProgramacao(context.Context, time.Time, time.Time) ([]Programacao, error)
	CriarProgramacao(context.Context, *Programacao) error
	ExcluirProgramacao(context.Context, string) error
}
