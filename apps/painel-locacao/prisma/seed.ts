import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DADOS_EXEMPLO, type DadosSeed } from './dados-exemplo'

// Carrega o .env explicitamente. Rodando via `tsx`, o carregamento automático depende do
// Prisma Client já ter inicializado, o que não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente. O Prisma reclama se faltar.
}

const prisma = new PrismaClient()

const CAMINHO_LOCAL = path.join('prisma', 'dados-locais.json')

/**
 * Usa os dados reais da empresa se `prisma/dados-locais.json` existir; senão, os fictícios.
 *
 * O arquivo local é git-ignored: nome de cliente, valor de locação e fornecedor não entram
 * no controle de versão.
 */
function carregarDados(): { dados: DadosSeed; origem: string } {
  try {
    const bruto = readFileSync(CAMINHO_LOCAL, 'utf-8')
    return { dados: JSON.parse(bruto) as DadosSeed, origem: CAMINHO_LOCAL }
  } catch {
    return { dados: DADOS_EXEMPLO, origem: 'prisma/dados-exemplo.ts (dados fictícios)' }
  }
}

async function main() {
  const { dados, origem } = carregarDados()
  console.log(`Origem dos dados: ${origem}`)

  for (const obra of dados.obras) {
    await prisma.obra.upsert({ where: { codigo: obra.codigo }, update: obra, create: obra })
  }
  console.log(`Obras: ${dados.obras.length}`)

  let totalAliases = 0
  for (const f of dados.fornecedores) {
    const fornecedor = await prisma.fornecedor.upsert({
      where: { nome: f.nome },
      update: { telefone: f.telefone },
      create: { nome: f.nome, telefone: f.telefone },
    })
    for (const alias of f.aliases) {
      await prisma.fornecedorAlias.upsert({
        where: { alias },
        update: { fornecedorId: fornecedor.id },
        create: { alias, fornecedorId: fornecedor.id },
      })
      totalAliases++
    }
  }
  console.log(`Fornecedores: ${dados.fornecedores.length} (${totalAliases} apelidos)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
