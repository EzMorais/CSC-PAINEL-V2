package alojamentos

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	dominio "siqueiracampos/servidor/internal/domain/alojamentos"
)

type Gerenciador struct{ Repo dominio.Repositorio }
type EntradaAlojamento struct{ Nome, CEP, Logradouro, Numero, Complemento, Bairro, Cidade, UF, Capacidade, Responsavel, Telefone, Foto, Observacoes string }
type EntradaQuarto struct{ AlojamentoID, Numero, Capacidade, Tipo, Observacoes string }
type EntradaRota struct{ Nome, Motorista, Veiculo, HorarioIda, HorarioVolta, Capacidade, ObraCodigo, Observacao string }
type EntradaAlocacao struct{ FuncionarioID, FuncionarioNome, Matricula, ObraCodigo, AlojamentoID, QuartoID, DataEntrada, Transporte, CaronaCom, RotaID, Telefone, Observacoes string }
type EntradaPedido struct{ AlojamentoID, Tipo, Titulo, Descricao, Prioridade, AlocacaoID string }
type EntradaProgramacao struct{ Data, Tipo, Titulo, Descricao, Horario, Responsavel, AlojamentoID string }

func opt(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
func inteiro(s string) *int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return nil
	}
	return &n
}
func data(s string) (time.Time, error) { return time.Parse(time.DateOnly, strings.TrimSpace(s)) }
func agora() time.Time                 { return time.Now().UTC() }

func (g *Gerenciador) SalvarAlojamento(ctx context.Context, id string, e EntradaAlojamento) (*dominio.Alojamento, error) {
	if len(strings.TrimSpace(e.Nome)) < 2 {
		return nil, fmt.Errorf("informe o nome do alojamento")
	}
	cap := inteiro(e.Capacidade)
	if cap != nil && *cap < 0 {
		return nil, fmt.Errorf("capacidade inválida")
	}
	a := &dominio.Alojamento{ID: id, Nome: strings.TrimSpace(e.Nome), CEP: opt(e.CEP), Logradouro: opt(e.Logradouro), Numero: opt(e.Numero), Complemento: opt(e.Complemento), Bairro: opt(e.Bairro), Cidade: opt(e.Cidade), UF: opt(e.UF), CapacidadeTotal: cap, ResponsavelNome: opt(e.Responsavel), TelefoneResponsavel: opt(e.Telefone), Foto: opt(e.Foto), Observacoes: opt(e.Observacoes), Ativo: true, CriadoEm: agora(), AtualizadoEm: agora()}
	if id == "" {
		if err := g.Repo.CriarAlojamento(ctx, a); err != nil {
			return nil, err
		}
	} else {
		if atual, _ := g.Repo.BuscarAlojamento(ctx, id); atual != nil {
			a.Ativo = atual.Ativo
			a.CriadoEm = atual.CriadoEm
		}
		if err := g.Repo.AtualizarAlojamento(ctx, a); err != nil {
			return nil, err
		}
	}
	return a, nil
}
func (g *Gerenciador) CriarQuarto(ctx context.Context, e EntradaQuarto) error {
	cap, err := strconv.Atoi(e.Capacidade)
	if strings.TrimSpace(e.Numero) == "" || err != nil || cap < 1 {
		return fmt.Errorf("informe quarto e capacidade válida")
	}
	return g.Repo.CriarQuarto(ctx, &dominio.Quarto{AlojamentoID: e.AlojamentoID, Numero: strings.TrimSpace(e.Numero), Capacidade: cap, Tipo: opt(e.Tipo), Observacoes: opt(e.Observacoes), Ativo: true, CriadoEm: agora()})
}
func (g *Gerenciador) CriarRota(ctx context.Context, e EntradaRota) error {
	if len(strings.TrimSpace(e.Nome)) < 2 {
		return fmt.Errorf("informe o nome da rota")
	}
	cap := inteiro(e.Capacidade)
	if cap != nil && *cap < 1 {
		return fmt.Errorf("capacidade inválida")
	}
	return g.Repo.CriarRota(ctx, &dominio.Rota{Nome: strings.TrimSpace(e.Nome), Motorista: opt(e.Motorista), Veiculo: opt(e.Veiculo), HorarioIda: opt(e.HorarioIda), HorarioVolta: opt(e.HorarioVolta), Capacidade: cap, ObraCodigo: opt(e.ObraCodigo), Observacao: opt(e.Observacao), Ativo: true, CriadoEm: agora(), AtualizadoEm: agora()})
}
func (g *Gerenciador) CriarAlocacao(ctx context.Context, e EntradaAlocacao, usuario string) error {
	if e.FuncionarioID == "" || e.AlojamentoID == "" {
		return fmt.Errorf("funcionário e alojamento são obrigatórios")
	}
	if atual, err := g.Repo.BuscarAlocacaoAtivaDoFuncionario(ctx, e.FuncionarioID); err != nil {
		return err
	} else if atual != nil {
		return fmt.Errorf("%s já está alocado em %s", atual.FuncionarioNome, atual.AlojamentoNome)
	}
	if e.QuartoID != "" {
		a, err := g.Repo.BuscarAlojamento(ctx, e.AlojamentoID)
		if err != nil {
			return err
		}
		if a == nil {
			return fmt.Errorf("alojamento não encontrado")
		}
		var quarto *dominio.Quarto
		for i := range a.Quartos {
			if a.Quartos[i].ID == e.QuartoID {
				quarto = &a.Quartos[i]
			}
		}
		if quarto == nil || !quarto.Ativo {
			return fmt.Errorf("quarto não encontrado ou inativo")
		}
		ocup, err := g.Repo.OcupacaoQuarto(ctx, e.QuartoID)
		if err != nil {
			return err
		}
		if ocup >= quarto.Capacidade {
			return fmt.Errorf("o quarto %s já está lotado (%d lugares)", quarto.Numero, quarto.Capacidade)
		}
	}
	d, err := data(e.DataEntrada)
	if err != nil {
		return fmt.Errorf("data de entrada inválida")
	}
	transporte := e.Transporte
	if transporte == "" {
		transporte = "PROPRIO"
	}
	return g.Repo.CriarAlocacao(ctx, &dominio.Alocacao{FuncionarioID: e.FuncionarioID, FuncionarioNome: e.FuncionarioNome, FuncionarioMatricula: e.Matricula, ObraCodigo: opt(e.ObraCodigo), AlojamentoID: e.AlojamentoID, QuartoID: opt(e.QuartoID), DataEntrada: d, Status: dominio.AlocacaoAtiva, TransporteTipo: transporte, CaronaComNome: opt(e.CaronaCom), RotaID: opt(e.RotaID), Telefone: opt(e.Telefone), Observacoes: opt(e.Observacoes), RegistradoPor: opt(usuario), CriadoEm: agora(), AtualizadoEm: agora()})
}
func (g *Gerenciador) Encerrar(ctx context.Context, id, saida, motivo string) error {
	lista, err := g.Repo.ListarAlocacoes(ctx, "")
	if err != nil {
		return err
	}
	var a *dominio.Alocacao
	for i := range lista {
		if lista[i].ID == id {
			a = &lista[i]
		}
	}
	if a == nil {
		return fmt.Errorf("alocação não encontrada")
	}
	if a.Status == dominio.AlocacaoEncerrada {
		return fmt.Errorf("esta alocação já foi encerrada")
	}
	d, err := data(saida)
	if err != nil {
		return fmt.Errorf("data de saída inválida")
	}
	if d.Before(a.DataEntrada) {
		return fmt.Errorf("a data de saída não pode ser anterior à de entrada")
	}
	return g.Repo.EncerrarAlocacao(ctx, id, d, opt(motivo))
}
func (g *Gerenciador) CriarPedido(ctx context.Context, e EntradaPedido, usuario string) error {
	if e.AlojamentoID == "" || len(strings.TrimSpace(e.Titulo)) < 3 {
		return fmt.Errorf("escolha o alojamento e descreva o pedido")
	}
	p := e.Prioridade
	if p == "" {
		p = "NORMAL"
	}
	return g.Repo.CriarPedido(ctx, &dominio.Pedido{AlojamentoID: e.AlojamentoID, Tipo: e.Tipo, Titulo: strings.TrimSpace(e.Titulo), Descricao: opt(e.Descricao), Prioridade: p, AlocacaoID: opt(e.AlocacaoID), Status: dominio.PedidoAberto, Origem: "SISTEMA", RegistradoPor: opt(usuario), CriadoEm: agora(), AtualizadoEm: agora()})
}
func (g *Gerenciador) AtualizarPedido(ctx context.Context, id, status, observacao, usuario string) error {
	encerrando := status == dominio.PedidoAtendido || status == dominio.PedidoCancelado
	var quando *time.Time
	nome := ""
	if encerrando {
		t := agora()
		quando = &t
		nome = usuario
	}
	return g.Repo.AtualizarPedido(ctx, id, status, opt(observacao), nome, quando)
}
func (g *Gerenciador) CriarProgramacao(ctx context.Context, e EntradaProgramacao, usuario string) error {
	d, err := data(e.Data)
	if err != nil || len(strings.TrimSpace(e.Titulo)) < 3 {
		return fmt.Errorf("informe data e título válidos")
	}
	return g.Repo.CriarProgramacao(ctx, &dominio.Programacao{Data: d, Tipo: e.Tipo, Titulo: strings.TrimSpace(e.Titulo), Descricao: opt(e.Descricao), Horario: opt(e.Horario), ResponsavelNome: opt(e.Responsavel), AlojamentoID: opt(e.AlojamentoID), CriadoPor: opt(usuario), CriadoEm: agora(), AtualizadoEm: agora()})
}
