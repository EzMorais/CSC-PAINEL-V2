// Package financeirooutbox processa eventos financeiros persistidos na mesma
// transação do fato gerador. O publicador é um adaptador injetado: e-mail,
// fiscal, banco ou webhook não ficam acoplados ao núcleo financeiro.
package financeirooutbox

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrPublicadorAusente = errors.New("publicador da outbox não configurado")

type Evento struct {
	ID, Tipo, AgregadoID, PayloadJSON string
	Tentativas                        int
}

type Publicador interface {
	Publicar(context.Context, Evento) error
}

type Processador struct {
	DB            *sql.DB
	Publicador    Publicador
	Agora         func() time.Time
	Lease         time.Duration
	BaseBackoff   time.Duration
	MaxTentativas int
}

func (p *Processador) agora() time.Time {
	if p.Agora != nil {
		return p.Agora().UTC()
	}
	return time.Now().UTC()
}

func (p *Processador) lease() time.Duration {
	if p.Lease <= 0 {
		return 2 * time.Minute
	}
	return p.Lease
}

func (p *Processador) maxTentativas() int {
	if p.MaxTentativas <= 0 {
		return 8
	}
	return p.MaxTentativas
}

func (p *Processador) backoff(tentativas int) time.Duration {
	base := p.BaseBackoff
	if base <= 0 {
		base = 5 * time.Second
	}
	// Limita a uma hora para que uma fila recuperável não fique invisível.
	for i := 1; i < tentativas && base < time.Hour; i++ {
		base *= 2
	}
	if base > time.Hour {
		return time.Hour
	}
	return base
}

func (p *Processador) reivindicar(ctx context.Context, agora time.Time) (*Evento, error) {
	tx, err := p.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var evento Evento
	var proxima sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,tipo,agregado_id,payload_json,tentativas,proxima_tentativa_em
		FROM financeiro_outbox
		WHERE processado_em IS NULL
		  AND (ultimo_erro IS NULL OR ultimo_erro NOT LIKE 'dead-letter:%')
		  AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em<=?)
		ORDER BY criado_em,id LIMIT 1`, agora.Format(time.RFC3339Nano)).Scan(&evento.ID, &evento.Tipo, &evento.AgregadoID, &evento.PayloadJSON, &evento.Tentativas, &proxima)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	// A própria coluna de próxima tentativa funciona como lease. Se o processo
	// morrer, o evento volta à fila quando o prazo expirar.
	leaseAte := agora.Add(p.lease()).Format(time.RFC3339Nano)
	if _, err = tx.ExecContext(ctx, `UPDATE financeiro_outbox SET proxima_tentativa_em=? WHERE id=? AND processado_em IS NULL`, leaseAte, evento.ID); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return &evento, nil
}

// ProcessarUma reivindica e processa no máximo um evento. Retorna processado=false
// quando a fila está vazia ou ainda aguardando o lease de uma tentativa anterior.
func (p *Processador) ProcessarUma(ctx context.Context) (processado bool, err error) {
	if p.DB == nil {
		return false, fmt.Errorf("banco da outbox não configurado")
	}
	if p.Publicador == nil {
		return false, ErrPublicadorAusente
	}
	agora := p.agora()
	evento, err := p.reivindicar(ctx, agora)
	if err != nil || evento == nil {
		return false, err
	}
	processado = true
	if err = p.Publicador.Publicar(ctx, *evento); err == nil {
		_, err = p.DB.ExecContext(ctx, `UPDATE financeiro_outbox SET processado_em=?,proxima_tentativa_em=NULL,ultimo_erro=NULL WHERE id=? AND processado_em IS NULL`, agora.Format(time.RFC3339Nano), evento.ID)
		return processado, err
	}

	tentativas := evento.Tentativas + 1
	erroTexto := strings.TrimSpace(err.Error())
	if tentativas >= p.maxTentativas() {
		erroTexto = "dead-letter: " + erroTexto
		_, updateErr := p.DB.ExecContext(ctx, `UPDATE financeiro_outbox SET tentativas=?,ultimo_erro=?,proxima_tentativa_em=NULL WHERE id=? AND processado_em IS NULL`, tentativas, erroTexto, evento.ID)
		if updateErr != nil {
			return processado, errors.Join(err, updateErr)
		}
		return processado, err
	}
	proxima := agora.Add(p.backoff(tentativas)).Format(time.RFC3339Nano)
	_, updateErr := p.DB.ExecContext(ctx, `UPDATE financeiro_outbox SET tentativas=?,ultimo_erro=?,proxima_tentativa_em=? WHERE id=? AND processado_em IS NULL`, tentativas, erroTexto, proxima, evento.ID)
	if updateErr != nil {
		return processado, errors.Join(err, updateErr)
	}
	return processado, err
}
