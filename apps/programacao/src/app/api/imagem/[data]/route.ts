import { lerSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { frentesAtivas } from '@/queries/programacao'
import { montarSvg, gerarPng } from '@/lib/imagem'
import { deIso, diaUtc, tituloDoDia } from '@/lib/dominio/constantes'

export const dynamic = 'force-dynamic'

/**
 * A imagem da programação do dia, pronta para mandar no grupo.
 *
 * Atrás da sessão: o print traz o nome de cento e cinquenta funcionários e onde cada um
 * está. Aberto, seria um endereço que devolve o quadro de pessoal da empresa a quem
 * souber a data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ data: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) return new Response('Não autenticado.', { status: 401 })

  const { data: iso } = await params
  const data = deIso(iso)
  if (!data) return new Response('Data inválida. Use aaaa-mm-dd.', { status: 400 })

  const programacao = await prisma.programacao.findUnique({
    where: { data: diaUtc(data) },
    include: { escalas: { orderBy: { ordem: 'asc' } }, recursos: { orderBy: { ordem: 'asc' } } },
  })
  if (!programacao) return new Response('Não há programação nesse dia.', { status: 404 })

  const [frentes, funcoes] = await Promise.all([frentesAtivas(), prisma.funcao.findMany()])
  // Frente sem ninguém e sem veículo não vira coluna: o print de hoje também não mostra
  // coluna vazia, e cada uma custa 200px de largura numa imagem já larga.
  const usadas = frentes.filter(
    (f) =>
      programacao.escalas.some((e) => e.frenteId === f.id) ||
      programacao.recursos.some((r) => r.frenteId === f.id),
  )

  const { svg } = montarSvg(
    tituloDoDia(diaUtc(data)),
    usadas.map((f) => ({ id: f.id, nome: f.nome, cor: f.cor, colunas: f.colunas })),
    programacao.escalas.map((e) => ({ frenteId: e.frenteId, nome: e.nome, funcaoSigla: e.funcaoSigla })),
    programacao.recursos.map((r) => ({
      frenteId: r.frenteId, tipo: r.tipo, descricao: r.descricao,
      motoristaNome: r.motoristaNome, destaque: r.destaque,
    })),
    new Map(funcoes.map((f) => [f.sigla, f.cor])),
  )

  const png = await gerarPng(svg)
  const nomeArquivo = `programacao-${iso}.png`

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // `inline` para a tela poder pré-visualizar; o botão de baixar força o download com
      // o atributo `download`, sem precisar de um segundo endereço.
      'Content-Disposition': `inline; filename="${nomeArquivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
