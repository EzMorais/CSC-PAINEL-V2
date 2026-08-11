package financeirooutbox

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"siqueiracampos/servidor/internal/infrastructure/database"
)

type publicadorFake struct {
	chamadas int
	erro     error
}

func (p *publicadorFake) Publicar(_ context.Context, _ Evento) error {
	p.chamadas++
	return p.erro
}

func novoOutbox(t *testing.T) *Processador {
	t.Helper()
	db, err := database.Abrir(filepath.Join(t.TempDir(), "outbox.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := database.AplicarMigracoes(db); err != nil {
		t.Fatal(err)
	}
	agora := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
	publicador := &publicadorFake{}
	return &Processador{DB: db, Publicador: publicador, Agora: func() time.Time { return agora }, BaseBackoff: time.Second, MaxTentativas: 2}
}

func TestProcessadorOutboxPublicaEConclui(t *testing.T) {
	p := novoOutbox(t)
	if _, err := p.DB.Exec(`INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em) VALUES('e1','TESTE','t1','{}','2026-08-11T11:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	ok, err := p.ProcessarUma(context.Background())
	if err != nil || !ok {
		t.Fatalf("processamento: ok=%v err=%v", ok, err)
	}
	var processado, pendente int
	if err := p.DB.QueryRow(`SELECT count(*) FROM financeiro_outbox WHERE id='e1' AND processado_em IS NOT NULL`).Scan(&processado); err != nil {
		t.Fatal(err)
	}
	_ = p.DB.QueryRow(`SELECT count(*) FROM financeiro_outbox WHERE id='e1' AND processado_em IS NULL`).Scan(&pendente)
	if processado != 1 || pendente != 0 || p.Publicador.(*publicadorFake).chamadas != 1 {
		t.Fatalf("outbox não concluída: processado=%d pendente=%d chamadas=%d", processado, pendente, p.Publicador.(*publicadorFake).chamadas)
	}
}

func TestProcessadorOutboxMarcaDeadLetterDepoisDoLimite(t *testing.T) {
	p := novoOutbox(t)
	p.Publicador.(*publicadorFake).erro = errors.New("serviço indisponível")
	if _, err := p.DB.Exec(`INSERT INTO financeiro_outbox(id,tipo,agregado_id,payload_json,criado_em) VALUES('e2','TESTE','t1','{}','2026-08-11T11:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	if _, err := p.ProcessarUma(context.Background()); err == nil {
		t.Fatal("primeira falha não retornou erro")
	}
	// A segunda tentativa fica elegível no instante do teste para validar o dead-letter sem esperar o backoff.
	if _, err := p.DB.Exec(`UPDATE financeiro_outbox SET proxima_tentativa_em='2026-08-11T11:00:00Z' WHERE id='e2'`); err != nil {
		t.Fatal(err)
	}
	if _, err := p.ProcessarUma(context.Background()); err == nil {
		t.Fatal("segunda falha não retornou erro")
	}
	var tentativas int
	var ultimo string
	if err := p.DB.QueryRow(`SELECT tentativas,ultimo_erro FROM financeiro_outbox WHERE id='e2'`).Scan(&tentativas, &ultimo); err != nil {
		t.Fatal(err)
	}
	if tentativas != 2 || len(ultimo) < len("dead-letter:") || ultimo[:len("dead-letter:")] != "dead-letter:" {
		t.Fatalf("dead-letter inválida: tentativas=%d erro=%q", tentativas, ultimo)
	}
}
