import { PrismaClient } from '@prisma/client'

// Rodando via `tsx`, o carregamento automático do .env não é garantido em checkout limpo.
try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env no diretório: a variável pode vir do ambiente.
}

const prisma = new PrismaClient()

/** Meia-noite UTC de N dias atrás — o referencial em que o sistema grava datas. */
function haDias(dias: number): Date {
  const agora = new Date()
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  return new Date(hoje - dias * 86_400_000)
}

const OBRAS = [
  { codigo: 'EX-1001-25', cliente: 'ALFA INDUSTRIAL', descricao: 'CONSTRUÇÃO DE GALPÃO', endereco: 'Rod. Anhanguera, km 24', cidade: 'São Paulo', uf: 'SP' },
  { codigo: 'EX-1002-25', cliente: 'BETA LOGÍSTICA', descricao: 'REDE DE DRENAGEM', endereco: 'Av. Marginal Tietê, 3000', cidade: 'Guarulhos', uf: 'SP' },
  { codigo: 'EX-1020-26', cliente: 'GAMA ALIMENTOS', descricao: 'AMPLIAÇÃO DA FÁBRICA', endereco: 'Rua Industrial, 450', cidade: 'Osasco', uf: 'SP' },
]

const ALOJAMENTOS = [
  {
    nome: 'Alojamento Central',
    logradouro: 'Rua das Palmeiras', numero: '120', bairro: 'Centro',
    cidade: 'Guarulhos', uf: 'SP', cep: '07012-000',
    responsavelNome: 'Sebastião Ramos', telefoneResponsavel: '(11) 98888-1122',
    quartos: [
      { numero: '101', capacidade: 4, tipo: 'MASCULINO' },
      { numero: '102', capacidade: 4, tipo: 'MASCULINO' },
      { numero: '103', capacidade: 2, tipo: 'FEMININO' },
    ],
  },
  {
    nome: 'Alojamento Vila Nova',
    logradouro: 'Av. dos Trabalhadores', numero: '85', bairro: 'Vila Nova',
    cidade: 'Osasco', uf: 'SP', cep: '06230-000',
    responsavelNome: 'Marlene Duarte', telefoneResponsavel: '(11) 97777-3344',
    quartos: [
      { numero: 'A', capacidade: 6, tipo: 'MASCULINO' },
      { numero: 'B', capacidade: 4, tipo: 'MISTO' },
    ],
  },
]

const ROTAS = [
  { nome: 'Rota Centro → EX-1001-25', motorista: 'Valdir Souza', veiculo: 'Micro-ônibus ABC-1D23', horarioIda: '06:00', horarioVolta: '17:30', capacidade: 20, obraCodigo: 'EX-1001-25' },
  { nome: 'Rota Vila Nova → EX-1020-26', motorista: 'Cleber Antunes', veiculo: 'Van XYZ-4E56', horarioIda: '06:20', horarioVolta: '17:00', capacidade: 15, obraCodigo: 'EX-1020-26' },
]

async function main() {
  for (const o of OBRAS) {
    await prisma.obra.upsert({ where: { codigo: o.codigo }, update: o, create: o })
  }
  console.log(`Obras: ${OBRAS.length}`)

  for (const r of ROTAS) {
    const existente = await prisma.rotaOnibus.findFirst({ where: { nome: r.nome } })
    if (!existente) await prisma.rotaOnibus.create({ data: r })
  }
  console.log(`Rotas: ${ROTAS.length}`)

  let quartosCriados = 0
  for (const { quartos, ...a } of ALOJAMENTOS) {
    const existente = await prisma.alojamento.findFirst({ where: { nome: a.nome } })
    if (existente) continue

    const criado = await prisma.alojamento.create({ data: a })
    for (const q of quartos) {
      await prisma.quarto.create({ data: { ...q, alojamentoId: criado.id } })
      quartosCriados++
    }
  }
  console.log(`Alojamentos: ${ALOJAMENTOS.length} (${quartosCriados} quartos)`)

  // Programação de hoje, para o painel não abrir vazio.
  const hoje = haDias(0)
  const alojamento = await prisma.alojamento.findFirst({ orderBy: { nome: 'asc' } })
  if (alojamento) {
    const jaTem = await prisma.programacao.count({ where: { data: hoje } })
    if (jaTem === 0) {
      await prisma.programacao.createMany({
        data: [
          { data: hoje, tipo: 'ONIBUS', titulo: 'Saída do ônibus para a obra', horario: '06:00', responsavelNome: 'Valdir Souza', alojamentoId: alojamento.id, criadoPor: 'seed' },
          { data: hoje, tipo: 'LIMPEZA', titulo: 'Limpeza das áreas comuns', horario: '14:00', alojamentoId: alojamento.id, criadoPor: 'seed' },
          { data: hoje, tipo: 'AVISO', titulo: 'Entrega de material de limpeza amanhã', criadoPor: 'seed' },
        ],
      })
      console.log('Programação de hoje: 3')
    }
  }

  // Um pedido em aberto, para a fila não abrir vazia.
  if (alojamento) {
    const jaTem = await prisma.pedido.count()
    if (jaTem === 0) {
      await prisma.pedido.create({
        data: {
          alojamentoId: alojamento.id,
          tipo: 'LIMPEZA',
          titulo: 'Repor papel higiênico e sabão',
          descricao: 'Acabou nos dois banheiros do térreo.',
          prioridade: 'ALTA',
          registradoPor: 'seed',
        },
      })
      console.log('Pedidos: 1')
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
