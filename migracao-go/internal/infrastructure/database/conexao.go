// Package database é o único lugar do binário que importa driver de SQLite — ver
// ARQUITETURA.md §1 e §5 pra justificativa de cada configuração abaixo.
package database

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// Abrir conecta ao SQLite com as configurações de produção documentadas em
// ARQUITETURA.md §5. Não roda migrações — chame AplicarMigracoes depois.
func Abrir(caminho string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", caminho)
	if err != nil {
		return nil, fmt.Errorf("abrir %s: %w", caminho, err)
	}

	// SQLite serializa escrita; várias conexões concorrentes do pool do Go só
	// competiriam entre si por um lock que o próprio banco já serializa, sem ganho real
	// no volume deste sistema — e evita "database is locked" por contenção interna.
	db.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA journal_mode = WAL",  // leitura concorrente com escrita
		"PRAGMA busy_timeout = 5000", // espera em contenção em vez de falhar a requisição
		"PRAGMA foreign_keys = ON",   // SQLite não aplica FK por padrão
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("%s: %w", p, err)
		}
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping %s: %w", caminho, err)
	}

	return db, nil
}
