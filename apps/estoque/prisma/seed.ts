import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DADOS_EXEMPLO, type DadosSeed } from './dados-exemplo'

// Mesma razão dos outros módulos: rodando via `tsx`, o carregamento automático do .env
// depende do Prisma Client já ter inicializado, o que não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

const CAMINHO_LOCAL = path.join('prisma', 'dados-locais.json')
const EMAIL_ADMIN = 'admin@siqueiracampos.com.br'

function carregarDados(): { dados: DadosSeed; origem: string } {
  try {
    const bruto = readFileSync(CAMINHO_LOCAL, 'utf-8')
    return { dados: JSON.parse(bruto) as DadosSeed, origem: CAMINHO_LOCAL }
  } catch {
    return { dados: DADOS_EXEMPLO, origem: 'prisma/dados-exemplo.ts (dados fictícios)' }
  }
}

/** Data de N dias atrás, em meia-noite UTC — o referencial em que o sistema grava datas. */
function haDias(dias: number): Date {
  const agora = new Date()
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  return new Date(hoje - dias * 86_400_000)
}

/**
 * Cria o primeiro usuário, e só o primeiro.
 *
 * `create` dentro de um teste de existência, não `upsert`: com upsert, rodar o seed de
 * novo devolveria a senha padrão a uma conta cuja senha já foi trocada.
 *
 * A senha padrão é a mesma dos outros módulos de propósito — eles compartilham a sessão, e
 * ter senhas diferentes para o mesmo e-mail confundiria mais do que protegeria.
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
    await prisma.obra.upsert({
      where: { codigo: obra.codigo },
      update: { cliente: obra.cliente, descricao: obra.descricao, responsavel: obra.responsavel },
      create: obra,
    })
  }
  console.log(`Obras: ${dados.obras.length}`)

  for (const f of dados.fornecedores) {
    await prisma.fornecedor.upsert({
      where: { nome: f.nome },
      update: { cnpj: f.cnpj, telefone: f.telefone },
      create: f,
    })
  }
  console.log(`Fornecedores: ${dados.fornecedores.length}`)

  // Códigos seguem o mesmo formato que a aplicação gera (MAT-0001), para o cadastro criado
  // pelo seed e o criado pela tela não parecerem vir de sistemas diferentes.
  let numero = 1
  let materiaisCriados = 0
  let materiaisExistentes = 0
  for (const m of dados.materiais) {
    const jaExiste = await prisma.material.findFirst({ where: { nome: m.nome } })
    if (jaExiste) {
      materiaisExistentes++
      continue
    }
    await prisma.material.create({
      data: { ...m, codigo: `MAT-${String(numero).padStart(4, '0')}` },
    })
    numero++
    materiaisCriados++
  }
  console.log(`Materiais: ${materiaisCriados} criados${materiaisExistentes ? `, ${materiaisExistentes} já existiam` : ''}`)

  // Movimentação é append-only: rodar o seed duas vezes dobraria o saldo de tudo. Por isso
  // o seed só lança o histórico quando ainda não há movimentação nenhuma.
  const jaTemMovimentacao = await prisma.movimentacao.count()
  if (jaTemMovimentacao > 0) {
    console.log(`Movimentações: ${jaTemMovimentacao} já lançadas — nada a fazer.`)
    return
  }

  const materiaisPorNome = new Map(
    (await prisma.material.findMany({ select: { id: true, nome: true } })).map((m) => [m.nome, m.id]),
  )
  const obrasPorCodigo = new Map(
    (await prisma.obra.findMany({ select: { id: true, codigo: true } })).map((o) => [o.codigo, o.id]),
  )
  const fornecedoresPorNome = new Map(
    (await prisma.fornecedor.findMany({ select: { id: true, nome: true } })).map((f) => [f.nome, f.id]),
  )

  let lancadas = 0
  for (const mov of dados.movimentacoes) {
    const materialId = materiaisPorNome.get(mov.material)
    if (!materialId) {
      console.warn(`  ! material não encontrado, movimentação ignorada: ${mov.material}`)
      continue
    }

    await prisma.movimentacao.create({
      data: {
        materialId,
        tipo: mov.tipo,
        quantidade: mov.quantidade,
        valorUnitario: mov.valorUnitario,
        obraId: mov.obraCodigo ? (obrasPorCodigo.get(mov.obraCodigo) ?? null) : null,
        fornecedorId: mov.fornecedorNome ? (fornecedoresPorNome.get(mov.fornecedorNome) ?? null) : null,
        documento: mov.documento,
        ocorridoEm: haDias(mov.haDias),
        registradoPor: 'seed',
      },
    })
    lancadas++
  }
  console.log(`Movimentações: ${lancadas} lançadas`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
