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
 * Cor de cada grupo de função — pinta o card no quadro e na imagem gerada.
 *
 * Vermelho para gestão/técnica/liderança, azul para apoio operacional, amarelo para
 * alvenaria e construção civil, roxo para instalações e acabamento, laranja para montagem e
 * estrutura metálica, cinza para operação de equipamento, verde para motorista e frota.
 * Editável depois por sigla — isto aqui é só o ponto de partida.
 */
const COR_GRUPO = {
  VERMELHO: '#8B0000',
  AZUL: '#1B4F91',
  AMARELO: '#C9A227',
  ROXO: '#6A3FA0',
  LARANJA: '#C1560C',
  CINZA: '#55606B',
  VERDE: '#1B6B34',
}

/**
 * As siglas que aparecem na planilha atual de funcionários.
 *
 * `cargoRh` liga a sigla ao nome do cargo no RH, para o quadro preencher a função sozinho
 * ao trazer alguém cadastrado. Onde ficou vazio é porque o cargo ainda não existe no RH —
 * o vínculo se faz ao cadastrar a pessoa lá.
 */
const FUNCOES = [
  { sigla: 'ADM',     nome: 'Administrativo',                    ordem: 1,  cargoRh: 'Auxiliar Administrativo', cor: COR_GRUPO.VERMELHO },
  { sigla: 'ENG',     nome: 'Engenheiro civil',                   ordem: 2,  cargoRh: 'Engenheiro Civil',        cor: COR_GRUPO.VERMELHO },
  { sigla: 'EO',      nome: 'Encarregado de obras',               ordem: 3,  cargoRh: 'Encarregado',             cor: COR_GRUPO.VERMELHO },
  { sigla: 'LC',      nome: 'Líder de caldeiraria',                ordem: 4,  cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'LO',      nome: 'Líder de obra',                       ordem: 5,  cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'TST',     nome: 'Técnico de segurança do trabalho',   ordem: 6,  cargoRh: 'Técnico de Segurança do Trabalho', cor: COR_GRUPO.VERMELHO },
  { sigla: 'STST',    nome: 'Supervisor téc. de segurança do trabalho', ordem: 7, cargoRh: null,                  cor: COR_GRUPO.VERMELHO },
  { sigla: 'EF',      nome: 'Encarregado financeiro',              ordem: 8,  cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'RH',      nome: 'Assistente de departamento pessoal',  ordem: 9,  cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'EP',      nome: 'Encarregado de projetos',             ordem: 10, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'ARQ',     nome: 'Assistente técnico de arquiteto',     ordem: 11, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'ALM',     nome: 'Almoxarife',                          ordem: 12, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'AP',      nome: 'Assistente técnico de projetos',      ordem: 13, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'AE',      nome: 'Assistente de engenharia',            ordem: 14, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'SUPO',    nome: 'Supervisor de obras',                 ordem: 15, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'DIRETOR', nome: 'Engenheiro civil / diretor',          ordem: 16, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'TE',      nome: 'Técnico de edificações',              ordem: 17, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'TELE',    nome: 'Técnico eletricista',                 ordem: 18, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'COMP',    nome: 'Comprador',                           ordem: 19, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'PROJ',    nome: 'Projetista',                          ordem: 20, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'DIAR',    nome: 'Diarista',                            ordem: 21, cargoRh: null,                      cor: COR_GRUPO.VERMELHO },
  { sigla: 'SO',      nome: 'Servente de obras',                   ordem: 22, cargoRh: 'Servente',                cor: COR_GRUPO.AZUL },
  { sigla: 'PD',      nome: 'Pedreiro',                            ordem: 23, cargoRh: 'Pedreiro',                cor: COR_GRUPO.AMARELO },
  { sigla: '1/2 PD',  nome: '1/2 oficial pedreiro',                ordem: 24, cargoRh: null,                      cor: COR_GRUPO.AMARELO },
  { sigla: 'CP',      nome: 'Carpinteiro',                         ordem: 25, cargoRh: 'Carpinteiro',             cor: COR_GRUPO.AMARELO },
  { sigla: 'ELET',    nome: 'Eletricista',                         ordem: 26, cargoRh: 'Eletricista',             cor: COR_GRUPO.ROXO },
  { sigla: 'PT',      nome: 'Pintor',                              ordem: 27, cargoRh: 'Pintor',                  cor: COR_GRUPO.ROXO },
  { sigla: 'MT',      nome: 'Montador',                            ordem: 28, cargoRh: null,                      cor: COR_GRUPO.LARANJA },
  { sigla: '1/2 MT',  nome: '1/2 oficial montador',                ordem: 29, cargoRh: null,                      cor: COR_GRUPO.LARANJA },
  { sigla: 'SOLD',    nome: 'Soldador',                            ordem: 30, cargoRh: null,                      cor: COR_GRUPO.LARANJA },
  { sigla: 'OP.RETRO',nome: 'Operador de retroescavadeira',        ordem: 31, cargoRh: null,                      cor: COR_GRUPO.CINZA },
  { sigla: 'MOT',     nome: 'Motorista',                           ordem: 32, cargoRh: 'Motorista',               cor: COR_GRUPO.VERDE },
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
