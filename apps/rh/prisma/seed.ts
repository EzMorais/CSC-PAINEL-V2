import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DADOS_EXEMPLO, type DadosSeed } from './dados-exemplo'
import { apenasDigitos, cpfValido } from '../src/lib/dominio/cpf'
import { EVENTO } from '../src/lib/dominio/constantes'

// Mesma razão do Painel de Locação: rodando via `tsx`, o carregamento automático do .env
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
 * A senha padrão é a mesma do Painel de Locação de propósito — os dois sistemas
 * compartilham a sessão, e ter senhas diferentes para o mesmo e-mail confundiria mais do
 * que protegeria.
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

  for (const cargo of dados.cargos) {
    await prisma.cargo.upsert({ where: { nome: cargo.nome }, update: cargo, create: cargo })
  }
  console.log(`Cargos: ${dados.cargos.length}`)

  // Índices por chave natural, para ligar funcionário → obra/cargo sem depender de ordem.
  const obras = new Map((await prisma.obra.findMany()).map((o) => [o.codigo, o.id]))
  const cargos = new Map((await prisma.cargo.findMany()).map((c) => [c.nome, c.id]))

  let criados = 0
  let pulados = 0
  let numero = 0

  for (const f of dados.funcionarios) {
    numero++

    // O seed grava direto no banco, sem passar pela action — então a validação de CPF
    // não roda sozinha aqui. Conferir na mão evita semear um dado que o próprio
    // formulário recusaria, e que ninguém conseguiria salvar depois de editar.
    if (!cpfValido(f.cpf)) {
      console.warn(`  ! CPF inválido, ignorado: ${f.nome} (${f.cpf})`)
      continue
    }

    const cpf = apenasDigitos(f.cpf)
    const existente = await prisma.funcionario.findUnique({ where: { cpf } })
    if (existente) {
      pulados++
      continue
    }

    const obraId = f.obraCodigo ? (obras.get(f.obraCodigo) ?? null) : null
    const cargoId = f.cargoNome ? (cargos.get(f.cargoNome) ?? null) : null
    const admitidoEm = haDias(f.admitidoHaDias)

    await prisma.funcionario.create({
      data: {
        matricula: `SC-${String(numero).padStart(4, '0')}`,
        nome: f.nome,
        cpf,
        status: f.status,
        admitidoEm,
        demitidoEm: f.status === 'DESLIGADO' ? haDias(Math.floor(f.admitidoHaDias / 4)) : null,
        telefone: f.telefone,
        cidade: f.cidade,
        uf: f.uf,
        tamanhoCamisa: f.tamanhoCamisa,
        tamanhoCalcado: f.tamanhoCalcado,
        obraId,
        cargoId,
        eventos: {
          create: {
            tipo: EVENTO.ADMISSAO,
            descricaoHumana: f.obraCodigo
              ? `Admitido na obra ${f.obraCodigo}`
              : 'Admitido',
            ocorridoEm: admitidoEm,
            registradoPor: 'seed',
            obraId,
          },
        },
      },
    })
    criados++
  }

  console.log(`Funcionários: ${criados} criados${pulados ? `, ${pulados} já existiam` : ''}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
