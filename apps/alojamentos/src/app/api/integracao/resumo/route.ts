import { verificarTokenIntegracao } from '@/lib/integracao'
import { indicadores } from '@/queries/dashboard'

export const dynamic = 'force-dynamic'

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * Devolve indicadores já FORMATADOS, com rótulo e tom — o Portal não conhece a regra de
 * capacidade por quarto, e duplicá-la lá faria as duas cópias divergirem.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const i = await indicadores()
    const ocupacao = i.capacidade > 0 ? Math.round((i.ocupados / i.capacidade) * 100) : 0

    return Response.json({
      indicadores: [
        { rotulo: 'Ocupação', valor: `${ocupacao}%`, tom: ocupacao >= 90 ? 'perigo' : ocupacao >= 75 ? 'alerta' : 'destaque' },
        { rotulo: 'Alojamentos', valor: String(i.totalAlojamentos), tom: 'neutro' },
        { rotulo: 'Moradores', valor: `${i.ocupados}/${i.capacidade}`, tom: 'neutro' },
        { rotulo: 'Vagas livres', valor: String(i.vagas), tom: i.vagas === 0 ? 'perigo' : 'bom' },
        { rotulo: 'Pedidos abertos', valor: String(i.pedidosAbertos), tom: i.pedidosAbertos > 0 ? 'alerta' : 'bom' },
        { rotulo: 'Programações hoje', valor: String(i.programacoesHoje), tom: 'neutro' },
      ],
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.'
    return Response.json({ erro }, { status: 500 })
  }
}
