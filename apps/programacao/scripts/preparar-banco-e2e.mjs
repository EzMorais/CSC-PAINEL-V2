import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Cria o SQLite descartável da suíte Playwright sem depender do schema engine do Prisma.
 * Em alguns Windows ele não inicia, embora o Prisma Client em execução funcione normalmente.
 * A fonte de verdade continua sendo cada migration.sql versionada.
 */
const raiz = path.resolve(import.meta.dirname, '..')
const pastaPrisma = path.join(raiz, 'prisma')
const arquivoBanco = path.join(pastaPrisma, 'programacao-e2e.db')
const pastaMigracoes = path.join(pastaPrisma, 'migrations')

fs.rmSync(arquivoBanco, { force: true })

const banco = new DatabaseSync(arquivoBanco)
try {
  banco.exec('PRAGMA foreign_keys = ON;')
  const migracoes = fs.readdirSync(pastaMigracoes, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort()

  for (const migration of migracoes) {
    const arquivoSql = path.join(pastaMigracoes, migration, 'migration.sql')
    if (!fs.existsSync(arquivoSql)) continue
    banco.exec(fs.readFileSync(arquivoSql, 'utf8'))
  }
} finally {
  banco.close()
}

console.log(`Banco e2e preparado: ${arquivoBanco}`)
