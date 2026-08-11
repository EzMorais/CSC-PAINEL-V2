package rh

import (
	"context"
	"fmt"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

// Fakes em memória — implementam as portas de internal/domain/rh/repositorio.go pra testar a
// camada de aplicação sem banco.

type funcionariosFake struct {
	porCPF          map[string]*dominio.Funcionario
	criados         []dominio.Funcionario
	eventosCriados  []dominio.Evento
	ultimaMatricula string
}

func novoFuncionariosFake() *funcionariosFake {
	return &funcionariosFake{porCPF: map[string]*dominio.Funcionario{}}
}

func (f *funcionariosFake) adicionarExistente(fu *dominio.Funcionario) { f.porCPF[fu.CPF] = fu }

func (f *funcionariosFake) BuscarPorID(ctx context.Context, id string) (*dominio.Funcionario, error) {
	for _, fu := range f.porCPF {
		if fu.ID == id {
			return fu, nil
		}
	}
	return nil, nil
}
func (f *funcionariosFake) BuscarPorCPF(ctx context.Context, cpf string) (*dominio.Funcionario, error) {
	return f.porCPF[cpf], nil
}
func (f *funcionariosFake) Listar(ctx context.Context, filtros dominio.FiltrosFuncionario) ([]dominio.Funcionario, error) {
	return nil, nil
}
func (f *funcionariosFake) ListarAtivosParaIntegracao(ctx context.Context) ([]dominio.Funcionario, error) {
	return nil, nil
}
func (f *funcionariosFake) UltimaMatricula(ctx context.Context) (string, error) {
	return f.ultimaMatricula, nil
}
func (f *funcionariosFake) Criar(ctx context.Context, fu *dominio.Funcionario, evento *dominio.Evento) error {
	fu.ID = fmt.Sprintf("func-%d", len(f.criados)+1)
	f.porCPF[fu.CPF] = fu
	f.criados = append(f.criados, *fu)
	if evento != nil {
		f.eventosCriados = append(f.eventosCriados, *evento)
	}
	return nil
}
func (f *funcionariosFake) Atualizar(ctx context.Context, fu *dominio.Funcionario, eventos []dominio.Evento) error {
	return nil
}
func (f *funcionariosFake) ContarVinculos(ctx context.Context, funcionarioID string) (dominio.VinculosFuncionario, error) {
	return dominio.VinculosFuncionario{}, nil
}
func (f *funcionariosFake) Excluir(ctx context.Context, id string) error { return nil }
func (f *funcionariosFake) ContarPorStatus(ctx context.Context) (map[string]int, error) {
	return nil, nil
}
func (f *funcionariosFake) ContarCadastrosIncompletos(ctx context.Context) (int, error) {
	return 0, nil
}
func (f *funcionariosFake) ContarPorObra(ctx context.Context) (map[string]int, error) {
	return nil, nil
}

type cargosFake struct {
	porNome map[string]*dominio.Cargo
	criados []dominio.Cargo
}

func novoCargosFake() *cargosFake { return &cargosFake{porNome: map[string]*dominio.Cargo{}} }

func (f *cargosFake) adicionar(c *dominio.Cargo) { f.porNome[dominio.NormalizarChave(c.Nome)] = c }

func (f *cargosFake) BuscarPorID(ctx context.Context, id string) (*dominio.Cargo, error) {
	for _, c := range f.porNome {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, nil
}
func (f *cargosFake) BuscarPorNome(ctx context.Context, nome string) (*dominio.Cargo, error) {
	return f.porNome[dominio.NormalizarChave(nome)], nil
}
func (f *cargosFake) Listar(ctx context.Context) ([]dominio.Cargo, error) {
	r := make([]dominio.Cargo, 0, len(f.porNome))
	for _, c := range f.porNome {
		r = append(r, *c)
	}
	return r, nil
}
func (f *cargosFake) Criar(ctx context.Context, c *dominio.Cargo) error {
	c.ID = fmt.Sprintf("cargo-%d", len(f.criados)+1)
	f.porNome[dominio.NormalizarChave(c.Nome)] = c
	f.criados = append(f.criados, *c)
	return nil
}
func (f *cargosFake) Atualizar(ctx context.Context, c *dominio.Cargo) error {
	f.porNome[dominio.NormalizarChave(c.Nome)] = c
	return nil
}
