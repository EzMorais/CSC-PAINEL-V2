import { PrismaClient } from '@prisma/client'

// Mesma razão dos outros módulos: rodando via `tsx`, o carregamento automático do .env
// depende do Prisma Client já ter inicializado, o que não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

/**
 * As frentes e as cores do quadro de hoje, tiradas da planilha em uso.
 *
 * Vêm no seed, e não em branco, porque um quadro vazio no primeiro acesso não diz o que ele
 * é. Com as colunas certas na tela, quem abre entende na hora que é a mesma programação —
 * só que arrastável.
 */
const FRENTES = [
  { nome: 'TOYOTA',           cor: '#F4A9A0', ordem: 1, colunas: 1 },
  { nome: 'MORELLI',          cor: '#4EA6DC', ordem: 2, colunas: 2 },
  { nome: 'CLARIOS',          cor: '#9DC3E6', ordem: 3, colunas: 1 },
  { nome: 'ADIMAX',           cor: '#F4B183', ordem: 4, colunas: 1 },
  { nome: 'INSTITUTO ADIMAX', cor: '#F4B183', ordem: 5, colunas: 1 },
  { nome: 'GALPÃO',           cor: '#FFFF00', ordem: 6, colunas: 1 },
  { nome: 'LINC',             cor: '#D9D9D9', ordem: 7, colunas: 1 },
]

/**
 * As siglas que aparecem na planilha atual.
 *
 * `cargoRh` liga a sigla ao nome do cargo no RH, para o quadro preencher a função sozinho
 * ao trazer alguém cadastrado. Onde ficou vazio é porque o cargo ainda não existe no RH —
 * o vínculo se faz na tela de Funções quando existir.
 */
const FUNCOES = [
  { sigla: 'ENG',     nome: 'Engenheiro',                 ordem: 1,  cargoRh: 'Engenheiro Civil' },
  { sigla: 'EO',      nome: 'Encarregado de obra',        ordem: 2,  cargoRh: 'Encarregado' },
  { sigla: 'MT',      nome: 'Mestre de obras',            ordem: 3,  cargoRh: 'Mestre de Obras' },
  { sigla: 'PD',      nome: 'Pedreiro',                   ordem: 4,  cargoRh: 'Pedreiro' },
  { sigla: '1/2 PD',  nome: 'Meio pedreiro',              ordem: 5,  cargoRh: null },
  { sigla: 'SO',      nome: 'Servente de obra',           ordem: 6,  cargoRh: 'Servente' },
  { sigla: 'CP',      nome: 'Carpinteiro',                ordem: 7,  cargoRh: 'Carpinteiro' },
  { sigla: 'PINTOR',  nome: 'Pintor',                     ordem: 8,  cargoRh: 'Pintor' },
  { sigla: 'ELETRICA',nome: 'Eletricista',                ordem: 9,  cargoRh: 'Eletricista' },
  { sigla: 'GESSO',   nome: 'Gesseiro',                   ordem: 10, cargoRh: null },
  { sigla: 'BLOCO',   nome: 'Bloco / alvenaria',          ordem: 11, cargoRh: null },
  { sigla: 'MOT',     nome: 'Motorista',                  ordem: 12, cargoRh: 'Motorista' },
  { sigla: 'OP',      nome: 'Operador de máquina',        ordem: 13, cargoRh: 'Operador de Máquinas' },
  { sigla: 'TST',     nome: 'Técnico de segurança',       ordem: 14, cargoRh: 'Técnico de Segurança do Trabalho' },
  { sigla: 'TS',      nome: 'Topógrafo / serviços',       ordem: 15, cargoRh: null },
  { sigla: 'TED',     nome: 'Técnico de edificações',     ordem: 16, cargoRh: null },
  { sigla: 'ADM',     nome: 'Administrativo',             ordem: 17, cargoRh: 'Auxiliar Administrativo' },
  { sigla: 'PD ELE',  nome: 'Pedreiro eletricista',       ordem: 18, cargoRh: null },
]

async function main() {
  let frentes = 0
  for (const f of FRENTES) {
    const existe = await prisma.frente.findUnique({ where: { nome: f.nome } })
    if (existe) continue
    await prisma.frente.create({ data: f })
    frentes++
  }

  let funcoes = 0
  for (const f of FUNCOES) {
    const existe = await prisma.funcao.findUnique({ where: { sigla: f.sigla } })
    if (existe) continue
    await prisma.funcao.create({ data: f })
    funcoes++
  }

  const totalFrentes = await prisma.frente.count()
  const totalFuncoes = await prisma.funcao.count()
  console.log(`Frentes: ${totalFrentes} (${frentes} criadas)`)
  console.log(`Funções: ${totalFuncoes} (${funcoes} criadas)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
