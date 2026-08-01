import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
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
 * Usa os dados reais se existirem no disco, senão os de exemplo.
 *
 * Nomes de clientes, telefones de fornecedores e nomes de funcionários não entram no
 * controle de versão — quem clona o repositório recebe dados fictícios e consegue rodar o
 * sistema mesmo assim. Para usar os seus, crie `prisma/dados-locais.json` no formato do
 * tipo `DadosSeed`; o arquivo é git-ignored.
 */
function carregarDados(): { dados: DadosSeed; origem: string } {
  try {
    const bruto = readFileSync(CAMINHO_LOCAL, 'utf-8')
    return { dados: JSON.parse(bruto) as DadosSeed, origem: CAMINHO_LOCAL }
  } catch {
    return { dados: DADOS_EXEMPLO, origem: 'prisma/dados-exemplo.ts (dados fictícios)' }
  }
}

const EMAIL_ADMIN = 'admin@siqueiracampos.com.br'

/**
 * Cria o primeiro usuário, e só o primeiro.
 *
 * Usa `create` dentro de um teste de existência em vez de `upsert` de propósito: com
 * upsert, rodar o seed de novo devolveria a senha padrão a uma conta cuja senha já foi
 * trocada — um jeito silencioso de reabrir o sistema para quem leu o README.
 */
async function semearAdmin() {
  const jaExiste = await prisma.usuario.findUnique({ where: { email: EMAIL_ADMIN } })
  if (jaExiste) {
    console.log(`Usuário: ${EMAIL_ADMIN} já existe — senha preservada.`)
    return
  }

  const senha = process.env.SENHA_ADMIN || 'locacao2026'
  await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      email: EMAIL_ADMIN,
      senhaHash: bcrypt.hashSync(senha, 10),
      papel: 'ADMIN',
    },
  })
  console.log(`Usuário: ${EMAIL_ADMIN} criado (senha: ${senha}) — troque no primeiro acesso.`)
}

async function main() {
  const { dados, origem } = carregarDados()
  console.log(`Origem dos dados: ${origem}`)

  await semearAdmin()

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
