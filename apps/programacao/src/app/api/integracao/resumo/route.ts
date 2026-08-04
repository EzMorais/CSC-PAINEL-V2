import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao-recebida'
import { amanhaUtc, hojeUtc, STATUS_PROGRAMACAO } from '@/lib/dominio/constantes'

export const dynamic = 'force-dynamic'

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * O indicador que importa é "a de amanhã já está pronta?" — é a pergunta que a diretoria
 * faz no fim da tarde, e a única resposta hoje é abrir o WhatsApp e procurar o print.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const hoje = hojeUtc()
    const amanha = amanhaUtc()

    const [deHoje, deAmanha, frentes, totalDias] = await Promise.all([
      prisma.programacao.findUnique({
        where: { data: hoje },
        include: { _count: { select: { escalas: true, recursos: true } } },
      }),
      prisma.programacao.findUnique({
        where: { data: amanha },
        include: { _count: { select: { escalas: true, recursos: true } } },
      }),
      prisma.frente.count({ where: { ativa: true } }),
      prisma.programacao.count(),
    ])

    const amanhaPronta = deAmanha?.status === STATUS_PROGRAMACAO.PUBLICADA

    return Response.json({
      indicadores: [
        { rotulo: 'Hoje na obra', valor: String(deHoje?._count.escalas ?? 0), tom: 'destaque' },
        {
          rotulo: 'Amanhã',
          valor: deAmanha ? `${deAmanha._count.escalas} pessoas` : 'não montada',
          tom: amanhaPronta ? 'bom' : deAmanha ? 'alerta' : 'perigo',
        },
        {
          rotulo: 'Situação de amanhã',
          valor: amanhaPronta ? 'publicada' : deAmanha ? 'rascunho' : '—',
          tom: amanhaPronta ? 'bom' : 'alerta',
        },
        { rotulo: 'Veículos hoje', valor: String(deHoje?._count.recursos ?? 0), tom: 'neutro' },
        { rotulo: 'Frentes ativas', valor: String(frentes), tom: 'neutro' },
        { rotulo: 'Dias registrados', valor: String(totalDias), tom: 'neutro' },
      ],
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.'
    return Response.json({ erro }, { status: 500 })
  }
}
