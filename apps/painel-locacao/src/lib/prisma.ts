import { PrismaClient } from '@prisma/client'

// Carrega o .env quando ainda não há DATABASE_URL no ambiente.
//
// O Next carrega o .env sozinho, então dentro da aplicação isto não faz nada. Mas os
// scripts avulsos (`npx tsx scripts/...`) não carregam, e falhavam com "Environment
// variable not found: DATABASE_URL" — num checkout limpo, todo script que toca o banco
// quebrava com uma mensagem que não sugere a causa.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env')
  } catch {
    // Sem arquivo: a variável pode vir do ambiente. O Prisma reclama se de fato faltar.
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
