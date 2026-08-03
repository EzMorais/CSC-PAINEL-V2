import { verificarTokenIntegracao } from '@/lib/integracao'
import { obterIndicadores } from '@/queries/dashboard'
import { brl } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * Devolve indicadores já FORMATADOS, com rótulo e tom. O Portal não conhece o domínio de
 * locação — se ele tivesse de decidir que "3 vencidos" é vermelho e "R$ 12.000" é neutro,
 * cada regra de negócio passaria a existir em dois lugares e envelheceria em um deles.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const i = await obterIndicadores()

    return Response.json({
      indicadores: [
        { rotulo: 'Valor em locação', valor: brl(i.valorEmLocacao), tom: 'destaque' },
        { rotulo: 'Locações ativas', valor: String(i.ativos), tom: 'neutro' },
        { rotulo: 'Vencem em 7 dias', valor: String(i.vencemEm7Dias), tom: i.vencemEm7Dias > 0 ? 'alerta' : 'bom' },
        { rotulo: 'Vencidas', valor: String(i.vencidos), tom: i.vencidos > 0 ? 'perigo' : 'bom' },
        { rotulo: 'Perdidos em aberto', valor: String(i.perdidosEmAberto), tom: i.perdidosEmAberto > 0 ? 'perigo' : 'bom' },
        { rotulo: 'Obra a confirmar', valor: String(i.aConfirmar), tom: i.aConfirmar > 0 ? 'alerta' : 'bom' },
      ],
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.'
    return Response.json({ erro }, { status: 500 })
  }
}
