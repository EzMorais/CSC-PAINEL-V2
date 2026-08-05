package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"siqueiracampos/servidor/internal/domain/estoque"
)

type EstoqueConfiguracaoEmailRepositorio struct{ DB *sql.DB }

func NovoEstoqueConfiguracaoEmailRepositorio(db *sql.DB) *EstoqueConfiguracaoEmailRepositorio {
	return &EstoqueConfiguracaoEmailRepositorio{DB: db}
}

const colunasConfiguracaoEmail = `id, provedor, host, porta, usuario, senha, remetente, destinatario_padrao,
	copia_para, enviar_automatico, limite_aprovacao_compra, limite_ajuste_inventario, ativo, testado_em, atualizado_em`

func lerConfiguracaoEmail(linha linhaEscaneavel) (*estoque.ConfiguracaoEmail, error) {
	var c estoque.ConfiguracaoEmail
	var provedor string
	var enviarAutomatico, ativo int
	var testadoEm *string
	var atualizadoEm string
	if err := linha.Scan(
		&c.ID, &provedor, &c.Host, &c.Porta, &c.Usuario, &c.Senha, &c.Remetente, &c.DestinatarioPadrao,
		&c.CopiaPara, &enviarAutomatico, &c.LimiteAprovacaoCompra, &c.LimiteAjusteInventario,
		&ativo, &testadoEm, &atualizadoEm,
	); err != nil {
		return nil, err
	}
	c.Provedor = estoque.ProvedorEmail(provedor)
	c.EnviarAutomatico = enviarAutomatico != 0
	c.Ativo = ativo != 0
	if testadoEm != nil {
		t, _ := time.Parse(time.RFC3339, *testadoEm)
		c.TestadoEm = &t
	}
	c.AtualizadoEm, _ = time.Parse(time.RFC3339, atualizadoEm)
	return &c, nil
}

func (r *EstoqueConfiguracaoEmailRepositorio) Obter(ctx context.Context) (*estoque.ConfiguracaoEmail, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasConfiguracaoEmail+` FROM configuracao_email_estoque WHERE id = 'unica'`)
	c, err := lerConfiguracaoEmail(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *EstoqueConfiguracaoEmailRepositorio) Salvar(ctx context.Context, c *estoque.ConfiguracaoEmail) error {
	agora := time.Now().UTC().Format(time.RFC3339)
	enviarAutomatico := 0
	if c.EnviarAutomatico {
		enviarAutomatico = 1
	}
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO configuracao_email_estoque
			(id, provedor, host, porta, usuario, senha, remetente, destinatario_padrao, copia_para,
			 enviar_automatico, limite_aprovacao_compra, limite_ajuste_inventario, ativo, testado_em, atualizado_em)
		VALUES ('unica', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
		ON CONFLICT (id) DO UPDATE SET
			provedor = excluded.provedor, host = excluded.host, porta = excluded.porta,
			usuario = excluded.usuario, senha = excluded.senha, remetente = excluded.remetente,
			destinatario_padrao = excluded.destinatario_padrao, copia_para = excluded.copia_para,
			enviar_automatico = excluded.enviar_automatico, ativo = 1, testado_em = NULL,
			atualizado_em = excluded.atualizado_em`,
		string(c.Provedor), c.Host, c.Porta, c.Usuario, c.Senha, c.Remetente, c.DestinatarioPadrao,
		c.CopiaPara, enviarAutomatico, c.LimiteAprovacaoCompra, c.LimiteAjusteInventario, agora,
	)
	return err
}

func (r *EstoqueConfiguracaoEmailRepositorio) MarcarTestada(ctx context.Context) error {
	_, err := r.DB.ExecContext(ctx,
		`UPDATE configuracao_email_estoque SET testado_em = ? WHERE id = 'unica'`,
		time.Now().UTC().Format(time.RFC3339))
	return err
}

func (r *EstoqueConfiguracaoEmailRepositorio) AtualizarAtivo(ctx context.Context, ativo bool) error {
	v := 0
	if ativo {
		v = 1
	}
	_, err := r.DB.ExecContext(ctx, `UPDATE configuracao_email_estoque SET ativo = ? WHERE id = 'unica'`, v)
	return err
}
