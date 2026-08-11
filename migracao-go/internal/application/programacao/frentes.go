package programacao

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

var reCorHex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type EntradaFrente struct {
	Nome, Cor, Logo, ObraCodigo, Colunas string
}

func validarFrente(e EntradaFrente) (nome, cor string, colunas int, err error) {
	nome = strings.TrimSpace(e.Nome)
	if len(nome) < 2 {
		return "", "", 0, fmt.Errorf("informe o nome do cliente ou da frente")
	}
	cor = strings.TrimSpace(e.Cor)
	if !reCorHex.MatchString(cor) {
		return "", "", 0, fmt.Errorf("escolha uma cor válida")
	}
	colunas = 1
	if strings.TrimSpace(e.Colunas) != "" {
		colunas, err = strconv.Atoi(strings.TrimSpace(e.Colunas))
		if err != nil || colunas < 1 || colunas > 4 {
			return "", "", 0, fmt.Errorf("colunas deve ser entre 1 e 4")
		}
	}
	return nome, cor, colunas, nil
}

// CriarFrente não reduz a logo enviada (o app original usa `sharp` para isso — sem
// equivalente direto em Go nesta fatia); a tela deve limitar o tamanho antes de enviar.
func (g *Gerenciador) CriarFrente(ctx context.Context, s identidade.Sessao, e EntradaFrente) (*dominio.Frente, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não cadastra frentes")
	}
	nome, cor, colunas, err := validarFrente(e)
	if err != nil {
		return nil, err
	}
	todas, err := g.Repo.ListarFrentes(ctx, false)
	if err != nil {
		return nil, err
	}
	ordem := 0
	for _, f := range todas {
		if f.Ordem > ordem {
			ordem = f.Ordem
		}
	}
	f := &dominio.Frente{
		Nome: nome, Cor: cor, Logo: strPtr(e.Logo), ObraCodigo: strPtr(e.ObraCodigo),
		Colunas: colunas, Ordem: ordem + 1, Ativa: true,
	}
	if err = g.Repo.CriarFrente(ctx, f); err != nil {
		return nil, erroFrenteDuplicada(err, nome)
	}
	return f, nil
}

func (g *Gerenciador) EditarFrente(ctx context.Context, s identidade.Sessao, id string, e EntradaFrente) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não edita frentes")
	}
	atual, err := g.Repo.BuscarFrente(ctx, id)
	if err != nil {
		return err
	}
	if atual == nil {
		return fmt.Errorf("frente não encontrada")
	}
	nome, cor, colunas, err := validarFrente(e)
	if err != nil {
		return err
	}
	atual.Nome, atual.Cor, atual.Colunas = nome, cor, colunas
	atual.Logo, atual.ObraCodigo = strPtr(e.Logo), strPtr(e.ObraCodigo)
	if err = g.Repo.AtualizarFrente(ctx, atual); err != nil {
		return erroFrenteDuplicada(err, nome)
	}
	return nil
}

func erroFrenteDuplicada(err error, nome string) error {
	if strings.Contains(strings.ToLower(err.Error()), "unique") {
		return fmt.Errorf("já existe uma frente chamada %q", nome)
	}
	return err
}

// AlternarFrente desativa em vez de apagar quando a frente já apareceu em algum dia —
// apagar levaria junto as escalas daquele dia, e a programação de uma terça passada
// deixaria de dizer quem estava onde.
func (g *Gerenciador) AlternarFrente(ctx context.Context, s identidade.Sessao, id string, ativa bool) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não altera frentes")
	}
	return g.Repo.AlternarFrente(ctx, id, ativa)
}

// ApagarFrente só serve para a frente criada por engano, que nunca entrou num dia.
func (g *Gerenciador) ApagarFrente(ctx context.Context, s identidade.Sessao, id string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não apaga frentes")
	}
	usos, err := g.Repo.ContarUsosFrente(ctx, id)
	if err != nil {
		return err
	}
	if usos > 0 {
		return fmt.Errorf("esta frente já foi usada em %d lançamentos; desative em vez de apagar", usos)
	}
	return g.Repo.ApagarFrente(ctx, id)
}

// MoverFrente sobe ou desce a frente — é a ordem em que as colunas saem no quadro/imagem.
func (g *Gerenciador) MoverFrente(ctx context.Context, s identidade.Sessao, id, direcao string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não reordena frentes")
	}
	todas, err := g.Repo.ListarFrentes(ctx, false)
	if err != nil {
		return err
	}
	i := -1
	for idx, f := range todas {
		if f.ID == id {
			i = idx
			break
		}
	}
	if i < 0 {
		return fmt.Errorf("frente não encontrada")
	}
	j := i - 1
	if direcao == "baixo" {
		j = i + 1
	}
	if j < 0 || j >= len(todas) {
		return nil
	}
	return g.Repo.ReordenarFrentes(ctx, todas[i].ID, todas[j].Ordem, todas[j].ID, todas[i].Ordem)
}
