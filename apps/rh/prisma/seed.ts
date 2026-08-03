import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DADOS_EXEMPLO, type DadosSeed } from './dados-exemplo'
import { apenasDigitos, cpfValido } from '../src/lib/dominio/cpf'
import { EVENTO, NIVEL_OBRA } from '../src/lib/dominio/constantes'

// Mesma razão do Painel de Locação: rodando via `tsx`, o carregamento automático do .env
// depende do Prisma Client já ter inicializado, o que não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

const CAMINHO_LOCAL = path.join('prisma', 'dados-locais.json')

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

/** O organograma da empresa: dois ramos e os setores de cada um. */
const ORGANOGRAMA: Record<string, string[]> = {
  Administrativo: [
    'RH', 'Compras', 'Financeiro', 'Contabilidade', 'Estoque', 'Frota',
    'Locações', 'TI', 'Jurídico', 'SST',
  ],
  Engenharia: [
    'Obras', 'Planejamento', 'Produção', 'Projetos', 'Orçamentos',
    'Topografia', 'Medições', 'Qualidade', 'Pós-Obra',
  ],
}

/**
 * Semeia ramos e setores. Ramo primeiro, porque o setor precisa do id do pai.
 *
 * `upsert` por nome: rodar o seed de novo não duplica nem apaga o que já existe.
 */
async function semearDepartamentos() {
  let total = 0
  for (const [ramo, setores] of Object.entries(ORGANOGRAMA)) {
    const pai = await prisma.departamento.upsert({
      where: { nome: ramo },
      update: {},
      create: { nome: ramo },
    })
    total++
    for (const setor of setores) {
      await prisma.departamento.upsert({
        where: { nome: setor },
        update: { paiId: pai.id },
        create: { nome: setor, paiId: pai.id },
      })
      total++
    }
  }
  console.log(`Departamentos: ${total}`)
}

/**
 * Nível de obra a partir do nome do cargo, só para os dados de exemplo terem algo plausível.
 *
 * Não é regra de negócio: profissão e nível são eixos independentes (um Pedreiro pode ser
 * Oficial ou Meio-oficial). Isto existe só para a tela não abrir com a coluna toda vazia.
 */
function nivelDoCargo(cargoNome: string | null | undefined): string | null {
  if (!cargoNome) return null
  const n = cargoNome.toLowerCase()
  if (n.includes('mestre')) return 'MESTRE_DE_OBRAS'
  if (n.includes('encarregado')) return 'ENCARREGADO'
  if (n.includes('engenheiro')) return 'ENGENHEIRO'
  if (n.includes('servente') || n.includes('ajudante')) return 'SERVENTE_AJUDANTE'
  if (n.includes('auxiliar') || n.includes('técnico')) return null // escritório
  return NIVEL_OBRA[4] // OFICIAL — pedreiro, carpinteiro, eletricista, soldador…
}

async function main() {
  const { dados, origem } = carregarDados()
  console.log(`Origem dos dados: ${origem}`)

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

  await semearDepartamentos()

  // Índices por chave natural, para ligar funcionário → obra/cargo sem depender de ordem.
  const obras = new Map((await prisma.obra.findMany()).map((o) => [o.codigo, o.id]))
  const cargos = new Map((await prisma.cargo.findMany()).map((c) => [c.nome, c.id]))
  const departamentos = new Map((await prisma.departamento.findMany()).map((d) => [d.nome, d.id]))
  const idObras = departamentos.get('Obras') ?? null

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
    const nivelObra = nivelDoCargo(f.cargoNome)
    // Quem tem nível de obra está no setor Obras; quem não tem é escritório e fica sem
    // setor definido, para o cadastro mostrar a pendência em vez de inventar um lotação.
    const departamentoId = nivelObra ? idObras : null

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
        tamanhoCalca: f.tamanhoCalca,
        tamanhoCalcado: f.tamanhoCalcado,
        obraId,
        cargoId,
        departamentoId,
        nivelObra,
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
