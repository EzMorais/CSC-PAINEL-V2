package programacao

import (
	"context"
	"fmt"
	"strings"
	"time"

	"siqueiracampos/servidor/internal/domain/identidade"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type Gerenciador struct {
	Repo dominio.Repositorio
}

// diaUtc é meia-noite UTC de uma data de calendário — mesma convenção do resto do sistema
// (e do apps/programacao original).
func diaUtc(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func dataCalendario(v string) (time.Time, error) {
	t, err := time.Parse(time.DateOnly, strings.TrimSpace(v))
	if err != nil {
		return time.Time{}, fmt.Errorf("data inválida")
	}
	return diaUtc(t), nil
}

func strPtr(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

// CriarDia cria o dia vazio. Idempotente: abrir duas abas não cria duas programações.
func (g *Gerenciador) CriarDia(ctx context.Context, s identidade.Sessao, dataTexto string) (*dominio.Programacao, error) {
	if !identidade.PodeLancar(s.Cargo) {
		return nil, fmt.Errorf("seu cargo não lança na programação")
	}
	data, err := dataCalendario(dataTexto)
	if err != nil {
		return nil, err
	}
	return g.Repo.CriarOuObterDia(ctx, data)
}

// CopiarDe copia a programação de outro dia para este — a função que economiza o tempo de
// verdade: quase todo mundo continua na mesma frente, então só se mexe em quem mudou.
// Substitui o que houver no destino (a tela avisa antes). Quem tem cadastro local e está
// inativo ou ausente não atravessa pro dia seguinte — copiar em cima da ausência faria
// alguém de férias aparecer escalado.
func (g *Gerenciador) CopiarDe(ctx context.Context, s identidade.Sessao, dataTexto, origemTexto string) (escalas, recursos int, err error) {
	if !identidade.PodeLancar(s.Cargo) {
		return 0, 0, fmt.Errorf("seu cargo não lança na programação")
	}
	data, err := dataCalendario(dataTexto)
	if err != nil {
		return 0, 0, err
	}
	origem, err := dataCalendario(origemTexto)
	if err != nil {
		return 0, 0, err
	}
	if data.Equal(origem) {
		return 0, 0, fmt.Errorf("a origem e o destino são o mesmo dia")
	}

	de, err := g.Repo.ProgramacaoDoDia(ctx, origem)
	if err != nil {
		return 0, 0, err
	}
	if de == nil {
		return 0, 0, fmt.Errorf("não há programação nesse dia para copiar")
	}

	idsLocais := map[string]bool{}
	for _, e := range de.Escalas {
		if e.FuncionarioLocalID != nil {
			idsLocais[*e.FuncionarioLocalID] = true
		}
	}
	indisponiveis := map[string]bool{}
	if len(idsLocais) > 0 {
		ids := make([]string, 0, len(idsLocais))
		for id := range idsLocais {
			ids = append(ids, id)
		}
		funcionarios, e := g.Repo.BuscarFuncionarios(ctx, ids)
		if e != nil {
			return 0, 0, e
		}
		for _, f := range funcionarios {
			if !f.Ativo || f.Ausente {
				indisponiveis[f.ID] = true
			}
		}
	}

	var escalasCopiar []dominio.Escala
	for _, e := range de.Escalas {
		if e.FuncionarioLocalID != nil && indisponiveis[*e.FuncionarioLocalID] {
			continue
		}
		escalasCopiar = append(escalasCopiar, e)
	}

	destino, err := g.Repo.CriarOuObterDia(ctx, data)
	if err != nil {
		return 0, 0, err
	}
	if err = g.Repo.SubstituirDia(ctx, destino.ID, escalasCopiar, de.Recursos); err != nil {
		return 0, 0, err
	}
	return len(escalasCopiar), len(de.Recursos), nil
}

// Publicar marca o dia como publicado. Não trava a edição depois: no canteiro alguém falta
// às 6h da manhã e a programação muda com o dia já publicado — travar faria a versão do
// sistema virar mentira, e o WhatsApp continuar sendo a fonte da verdade.
func (g *Gerenciador) Publicar(ctx context.Context, s identidade.Sessao, dataTexto string) error {
	if !identidade.PodeLancar(s.Cargo) {
		return fmt.Errorf("seu cargo não lança na programação")
	}
	data, err := dataCalendario(dataTexto)
	if err != nil {
		return err
	}
	return g.Repo.Publicar(ctx, data, s.Nome)
}

// ConferirQuadroDoDia carrega o dia e devolve os conflitos encontrados — ver
// domain/programacao/conflitos.go. Sem integração com a Frota nesta fatia (fora do escopo
// da migração, ver README), então nenhum veículo aparece como "em manutenção".
func (g *Gerenciador) ConferirQuadroDoDia(ctx context.Context, p *dominio.Programacao) ([]dominio.Conflito, error) {
	frentes, err := g.Repo.ListarFrentes(ctx, false)
	if err != nil {
		return nil, err
	}
	return dominio.ConferirQuadro(p.Escalas, p.Recursos, frentes, nil), nil
}
