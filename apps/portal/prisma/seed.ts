import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Mesma razão dos outros módulos: rodando via `tsx`, o carregamento automático do .env
// depende do Prisma Client já ter inicializado, o que não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

const EMAIL_ADMIN = 'admin@siqueiracampos.com.br'

/**
 * Cria o primeiro administrador, e só o primeiro.
 *
 * `create` dentro de um teste de existência, não `upsert`: com upsert, rodar o seed de novo
 * devolveria a senha padrão a uma conta cuja senha já foi trocada.
 *
 * A senha padrão é a mesma que os módulos usavam antes do Portal existir, para quem já
 * usava o sistema não descobrir na hora do login que ela mudou.
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
      cargo: 'ADMIN',
    },
  })
  console.log(`Usuário: ${EMAIL_ADMIN} criado (senha: ${senha}) — troque no primeiro acesso.`)
}

/**
 * Exemplos de cada cargo, para dar o que explorar em quem acabou de instalar.
 *
 * Todos com a mesma senha de exemplo, e o console avisa disso: são contas de demonstração,
 * não de gente de verdade, e quem for usar para valer deve apagá-las.
 */
const EXEMPLOS = [
  { nome: 'Carla Diretoria',    email: 'diretoria@exemplo.com.br',  cargo: 'DIRETORIA',   modulos: [] },
  { nome: 'Bruno Gerente',      email: 'gerente@exemplo.com.br',    cargo: 'GERENTE',     modulos: ['ESTOQUE', 'PAINEL'] },
  { nome: 'Ana Almoxarife',     email: 'almoxarife@exemplo.com.br', cargo: 'OPERACIONAL', modulos: ['ESTOQUE'] },
  { nome: 'Diego RH',           email: 'rh@exemplo.com.br',         cargo: 'OPERACIONAL', modulos: ['RH'] },
  { nome: 'Marcos Mestre',      email: 'mestre@exemplo.com.br',     cargo: 'CONSULTA',    modulos: ['PAINEL', 'RH'] },
]

async function semearExemplos() {
  let criados = 0
  for (const e of EXEMPLOS) {
    const jaExiste = await prisma.usuario.findUnique({ where: { email: e.email } })
    if (jaExiste) continue
    await prisma.usuario.create({
      data: {
        nome: e.nome,
        email: e.email,
        senhaHash: bcrypt.hashSync('exemplo2026', 10),
        cargo: e.cargo,
        observacao: 'Conta de exemplo criada pelo seed — apague antes de usar para valer.',
        acessos: { create: e.modulos.map((modulo) => ({ modulo })) },
      },
    })
    criados++
  }
  if (criados > 0) {
    console.log(`Usuários de exemplo: ${criados} criados (senha: exemplo2026) — apague antes de usar para valer.`)
  } else {
    console.log('Usuários de exemplo: já existiam.')
  }
}

async function main() {
  await semearAdmin()
  await semearExemplos()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
