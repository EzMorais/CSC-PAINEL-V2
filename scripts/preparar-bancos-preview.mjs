import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

/**
 * Prepara os bancos SQLite dos módulos Next durante a demonstração local.
 *
 * Os módulos migrados para o Go e os módulos Next não compartilham o mesmo schema:
 * reutilizar portal.db entre eles faz o Prisma procurar tabelas PascalCase que não
 * existem no banco normalizado do Go. Cada app recebe, portanto, um banco próprio.
 * O Prisma migrate engine não é confiável neste checkout Windows sem os binários
 * pós-instalação; aplicar os SQL versionados com better-sqlite3 mantém o mesmo
 * contrato e registra _prisma_migrations para que o estado continue auditável.
 */

const raiz = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const Database = require(path.join(raiz, 'apps', 'frota', 'node_modules', 'better-sqlite3'))

const aplicativos = ['portal', 'painel-locacao', 'rh', 'estoque', 'alojamentos', 'programacao']

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex')
}

function prepararBanco(aplicativo) {
  const prisma = path.join(raiz, 'apps', aplicativo, 'prisma')
  const migracoes = path.join(prisma, 'migrations')
  const arquivo = path.join(prisma, 'preview.db')
  const db = new Database(arquivo)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `)

  const nomes = fs.readdirSync(migracoes, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort()

  for (const nome of nomes) {
    const arquivoSql = path.join(migracoes, nome, 'migration.sql')
    if (!fs.existsSync(arquivoSql)) continue

    const sql = fs.readFileSync(arquivoSql, 'utf8')
    const hash = checksum(sql)
    const existente = db.prepare(
      'SELECT id, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = ?',
    ).get(nome)

    if (existente?.checksum && existente.checksum !== hash) {
      throw new Error(`${aplicativo}: checksum divergente na migration ${nome}`)
    }
    if (existente?.finished_at && !existente.rolled_back_at) continue

    const id = existente?.id ?? crypto.randomUUID()
    if (!existente) {
      db.prepare(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      ).run(id, hash, nome)
    }

    try {
      db.transaction(() => db.exec(sql))()
      db.prepare(
        'UPDATE "_prisma_migrations" SET checksum = ?, finished_at = CURRENT_TIMESTAMP, rolled_back_at = NULL, applied_steps_count = 1, logs = NULL WHERE id = ?',
      ).run(hash, id)
      console.log(`[${aplicativo}] migration aplicada: ${nome}`)
    } catch (erro) {
      db.prepare(
        'UPDATE "_prisma_migrations" SET logs = ?, rolled_back_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(String(erro), id)
      throw erro
    }
  }

  db.close()
}

for (const aplicativo of aplicativos) prepararBanco(aplicativo)
