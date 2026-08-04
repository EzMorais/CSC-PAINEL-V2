package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
)

//go:embed migrations/*.sql
var arquivosMigracao embed.FS

// AplicarMigracoes roda cada .sql em migrations/ em ordem alfabética, uma vez só — o nome
// do arquivo vira a chave de "já rodou". Idempotente: pode chamar em todo start do processo.
func AplicarMigracoes(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			versao      TEXT PRIMARY KEY,
			aplicada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`); err != nil {
		return fmt.Errorf("criar schema_migrations: %w", err)
	}

	entradas, err := fs.ReadDir(arquivosMigracao, "migrations")
	if err != nil {
		return fmt.Errorf("ler diretório de migrations: %w", err)
	}
	nomes := make([]string, 0, len(entradas))
	for _, e := range entradas {
		nomes = append(nomes, e.Name())
	}
	sort.Strings(nomes)

	for _, nome := range nomes {
		var ja int
		if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE versao = ?`, nome).Scan(&ja); err != nil {
			return fmt.Errorf("checar migração %s: %w", nome, err)
		}
		if ja > 0 {
			continue
		}

		conteudo, err := arquivosMigracao.ReadFile("migrations/" + nome)
		if err != nil {
			return fmt.Errorf("ler migração %s: %w", nome, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(conteudo)); err != nil {
			tx.Rollback()
			return fmt.Errorf("aplicar migração %s: %w", nome, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (versao) VALUES (?)`, nome); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
