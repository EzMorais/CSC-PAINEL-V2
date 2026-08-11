package programacao

import (
	"context"
	"fmt"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type EntradaFuncao struct{ Sigla, Nome, CargoRH, Cor string }

func validarFuncao(e EntradaFuncao) (sigla, nome, cor string, err error) {
	sigla = strings.ToUpper(strings.TrimSpace(e.Sigla))
	if sigla == "" {
		return "", "", "", fmt.Errorf("informe a sigla")
	}
	nome = strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return "", "", "", fmt.Errorf("informe o nome da função")
	}
	cor = strings.TrimSpace(e.Cor)
	if cor == "" {
		cor = "#8B0000"
	} else if !reCorHex.MatchString(cor) {
		return "", "", "", fmt.Errorf("escolha uma cor válida")
	}
	return sigla, nome, cor, nil
}

func (g *Gerenciador) CriarFuncao(ctx context.Context, s identidade.Sessao, e EntradaFuncao) (*dominio.Funcao, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não cadastra funções")
	}
	sigla, nome, cor, err := validarFuncao(e)
	if err != nil {
		return nil, err
	}
	todas, err := g.Repo.ListarFuncoes(ctx, false)
	if err != nil {
		return nil, err
	}
	ordem := 0
	for _, f := range todas {
		if f.Ordem > ordem {
			ordem = f.Ordem
		}
	}
	f := &dominio.Funcao{Sigla: sigla, Nome: nome, Cor: cor, CargoRH: strPtr(e.CargoRH), Ordem: ordem + 1, Ativa: true}
	if err = g.Repo.CriarFuncao(ctx, f); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, fmt.Errorf("já existe uma função com a sigla %q", sigla)
		}
		return nil, err
	}
	return f, nil
}

func (g *Gerenciador) EditarFuncao(ctx context.Context, s identidade.Sessao, id string, e EntradaFuncao) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não edita funções")
	}
	sigla, nome, cor, err := validarFuncao(e)
	if err != nil {
		return err
	}
	return g.Repo.AtualizarFuncao(ctx, &dominio.Funcao{ID: id, Sigla: sigla, Nome: nome, Cor: cor, CargoRH: strPtr(e.CargoRH)})
}

func (g *Gerenciador) AlternarFuncao(ctx context.Context, s identidade.Sessao, id string, ativa bool) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não altera funções")
	}
	return g.Repo.AlternarFuncao(ctx, id, ativa)
}
