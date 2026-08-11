package rh

import (
	"context"
	"errors"
)

var (
	ErrCargoDuplicado        = errors.New("já existe um cargo com este nome")
	ErrDepartamentoDuplicado = errors.New("já existe um departamento com este nome")
	ErrMatriculaDuplicada    = errors.New("matrícula já usada")
	ErrCPFDuplicado          = errors.New("já existe um funcionário com este CPF")
)

type CargoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Cargo, error)
	BuscarPorNome(ctx context.Context, nome string) (*Cargo, error)
	Listar(ctx context.Context) ([]Cargo, error)
	Criar(ctx context.Context, c *Cargo) error
	Atualizar(ctx context.Context, c *Cargo) error
}

type DepartamentoRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Departamento, error)
	BuscarPorNome(ctx context.Context, nome string) (*Departamento, error)
	// Listar devolve todos, ramos primeiro (PaiID nil) — é o que a UI e o seed esperam pra
	// resolver o pai antes do filho.
	Listar(ctx context.Context) ([]Departamento, error)
	// ListarRamos devolve só quem não tem pai — usado pro <select> de ramo na tela de novo setor.
	ListarRamos(ctx context.Context) ([]Departamento, error)
	Criar(ctx context.Context, d *Departamento) error
}

type FiltrosFuncionario struct {
	Busca   string
	Status  string
	ObraID  string
	CargoID string
}

type FuncionarioRepositorio interface {
	BuscarPorID(ctx context.Context, id string) (*Funcionario, error)
	BuscarPorCPF(ctx context.Context, cpf string) (*Funcionario, error)
	Listar(ctx context.Context, filtros FiltrosFuncionario) ([]Funcionario, error)
	// ListarAtivosParaIntegracao devolve quem não está DESLIGADO — usada por
	// /api/integracao/funcionarios (COMPORTAMENTO.md §6), ordenada por nome.
	ListarAtivosParaIntegracao(ctx context.Context) ([]Funcionario, error)
	UltimaMatricula(ctx context.Context) (string, error)
	// Criar grava o funcionário e o evento ADMISSAO numa transação só — timeline não pode
	// nascer vazia (COMPORTAMENTO.md §3).
	Criar(ctx context.Context, f *Funcionario, eventoAdmissao *Evento) error
	// Atualizar grava o funcionário e os eventos automáticos (0 a 3, conforme o que mudou)
	// numa transação só — ver COMPORTAMENTO.md §3.
	Atualizar(ctx context.Context, f *Funcionario, eventos []Evento) error
	ContarVinculos(ctx context.Context, funcionarioID string) (VinculosFuncionario, error)
	// Excluir apaga o funcionário — eventos e dependentes somem junto via ON DELETE CASCADE
	// (COMPORTAMENTO.md §4). Só chamar depois de confirmar Vinculos.Total() == 0.
	Excluir(ctx context.Context, id string) error

	// Indicadores do dashboard — COMPORTAMENTO.md §8.
	ContarPorStatus(ctx context.Context) (map[string]int, error)
	ContarCadastrosIncompletos(ctx context.Context) (int, error)
	ContarPorObra(ctx context.Context) (map[string]int, error)
}

type DependenteRepositorio interface {
	ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]Dependente, error)
	Criar(ctx context.Context, d *Dependente) error
	Remover(ctx context.Context, id string) error
}

type EventoRepositorio interface {
	ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]Evento, error)
	// ListarRecentes traz os últimos eventos de TODOS os funcionários — usado no dashboard
	// (COMPORTAMENTO.md §8).
	ListarRecentes(ctx context.Context, limite int) ([]Evento, error)
	Criar(ctx context.Context, e *Evento) error
}
