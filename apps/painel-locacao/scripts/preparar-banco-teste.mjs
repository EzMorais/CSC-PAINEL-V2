import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// O schema-engine do Prisma 6.19 falha silenciosamente no Windows ao criar um SQLite
// temporário vazio. O E2E usa o SQLite nativo do Node para aplicar as mesmas migrações
// versionadas; o banco da aplicação continua sendo gerenciado pelo Prisma normalmente.
const caminhoBanco = resolve('prisma', 'teste.db')
const caminhoMigracoes = resolve('prisma', 'migrations')
const banco = new DatabaseSync(caminhoBanco)

banco.exec(`
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY NOT NULL,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME NOT NULL DEFAULT current_timestamp,
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )
`)

const aplicadas = new Set(
  banco.prepare('SELECT migration_name FROM _prisma_migrations').all().map((linha) => linha.migration_name),
)

for (const nome of readdirSync(caminhoMigracoes).filter((item) => statSync(join(caminhoMigracoes, item)).isDirectory()).sort()) {
  if (aplicadas.has(nome)) continue

  const sql = readFileSync(join(caminhoMigracoes, nome, 'migration.sql'), 'utf8')
  const agora = new Date().toISOString()
  const checksum = createHash('sha256').update(sql).digest('hex')

  banco.exec('BEGIN')
  try {
    banco.exec(sql)
    banco.prepare(`
      INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(randomUUID(), checksum, agora, nome, agora)
    banco.exec('COMMIT')
    console.log(`Migração aplicada: ${nome}`)
  } catch (erro) {
    banco.exec('ROLLBACK')
    throw erro
  }
}

banco.close()
console.log('Banco de teste pronto.')
