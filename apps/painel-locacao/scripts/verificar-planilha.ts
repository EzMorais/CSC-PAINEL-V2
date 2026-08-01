import { assinaturaAtivo, assinaturaDevolvida, lerPlanilha } from '../src/lib/planilha/parser'
import { construirMapa } from '../src/lib/planilha/mapa-abas'
import { prisma } from '../src/lib/prisma'

const CAMINHO = 'dados/Maquinas_Alugadas_Controle_REVISADA.xlsx'

const ESPERADO = { ativos: 242, devolvidos: 63, perdidos: 16, aConfirmar: 110 }

async function main() {
  // O mapa aba -> obra vem das obras cadastradas, igual à importação de verdade. Se este
  // script usasse uma tabela fixa, ele validaria um caminho que a aplicação não percorre.
  const obras = await prisma.obra.findMany({ orderBy: { codigo: 'asc' }, select: { codigo: true, abaOrigem: true } })
  if (!obras.length) {
    console.log('Nenhuma obra cadastrada. Rode `npm run db:seed` antes.')
    process.exit(1)
  }
  const { linhas, ignoradas } = await lerPlanilha(CAMINHO, construirMapa(obras))

  const ativos = linhas.filter((l) => !l.devolvida).length
  const devolvidos = linhas.filter((l) => l.devolvida).length
  const perdidos = linhas.filter((l) => l.estado === 'PERDIDO').length
  const aConfirmar = linhas.filter((l) => l.obraAConfirmar).length

  console.log('Por aba:')
  const porAba = new Map<string, { a: number; d: number }>()
  for (const l of linhas) {
    const e = porAba.get(l.aba) ?? { a: 0, d: 0 }
    if (l.devolvida) e.d++
    else e.a++
    porAba.set(l.aba, e)
  }
  for (const [aba, { a, d }] of porAba) {
    console.log(`  ${aba.padEnd(24)} ativos=${String(a).padStart(3)}  devolvidos=${String(d).padStart(3)}`)
  }

  console.log('\nTotais:')
  const conferir = (nome: string, obtido: number, esperado: number) => {
    const ok = obtido === esperado
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${nome.padEnd(24)} esperado=${esperado}  obtido=${obtido}`)
    return ok
  }
  const resultados = [
    conferir('locações ativas', ativos, ESPERADO.ativos),
    conferir('devolvidas', devolvidos, ESPERADO.devolvidos),
    conferir('itens perdidos', perdidos, ESPERADO.perdidos),
    conferir('obra a confirmar', aConfirmar, ESPERADO.aConfirmar),
  ]

  console.log('\nPossíveis duplicatas entre abas (sinalizadas, não removidas):')
  const ativosDup = linhas.filter((l) => !l.devolvida && l.possivelDuplicata)
  const devolvidasDup = linhas.filter((l) => l.devolvida && l.possivelDuplicata)
  const assinaturasAtivosDup = new Set(ativosDup.map(assinaturaAtivo))
  const assinaturasDevolvidasDup = new Set(devolvidasDup.map(assinaturaDevolvida))
  console.log(`  ativos:     ${ativosDup.length} registros, ${assinaturasAtivosDup.size} assinaturas distintas`)
  console.log(`  devolvidas: ${devolvidasDup.length} registros, ${assinaturasDevolvidasDup.size} assinaturas distintas`)

  if (assinaturasDevolvidasDup.size) {
    console.log('\nAssinaturas de devolução repetidas entre abas (com as abas onde aparecem):')
    const abasPorAssinatura = new Map<string, Set<string>>()
    const descricaoPorAssinatura = new Map<string, string>()
    for (const l of devolvidasDup) {
      const chave = assinaturaDevolvida(l)
      const abas = abasPorAssinatura.get(chave) ?? new Set<string>()
      abas.add(l.aba)
      abasPorAssinatura.set(chave, abas)
      descricaoPorAssinatura.set(chave, l.descricao)
    }
    for (const [chave, abas] of abasPorAssinatura) {
      const trCodigo = chave.split('|')[1] || '(sem Tr)'
      console.log(`  ${descricaoPorAssinatura.get(chave)} (Tr ${trCodigo}): ${[...abas].sort().join(', ')}`)
    }
  }

  const semFornecedor = linhas.filter((l) => !l.fornecedorBruto).length
  const semDatas = linhas.filter((l) => !l.devolvida && (!l.dataInicio || !l.dataFim)).length
  console.log(`\n  sem fornecedor: ${semFornecedor}`)
  console.log(`  ativos sem datas: ${semDatas}`)

  const fornecedores = new Set(linhas.map((l) => l.fornecedorBruto).filter(Boolean))
  console.log(`\nFornecedores distintos na planilha (${fornecedores.size}):`)
  for (const f of [...fornecedores].sort()) console.log(`  ${f}`)

  if (ignoradas.length) {
    console.log('\nIgnoradas:')
    for (const i of ignoradas) console.log(`  ${i.aba} linha ${i.linha}: ${i.motivo}`)
  }

  const todosOk = resultados.every(Boolean)
  console.log(todosOk ? '\nParser confere com a planilha.' : '\nParser divergiu — investigue antes de importar.')
  await prisma.$disconnect()
  process.exit(todosOk ? 0 : 1)
}

main()
