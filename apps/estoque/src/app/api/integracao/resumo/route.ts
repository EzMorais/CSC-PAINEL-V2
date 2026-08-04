import { verificarTokenIntegracao } from '@/lib/integracao'
import { indicadores } from '@/queries/dashboard'
import { brl } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * Devolve indicadores já FORMATADOS, com rótulo e tom — o Portal não conhece as regras de
 * saldo mínimo do almoxarifado, e duplicá-las lá faria as duas cópias divergirem.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const i = await indicadores()

    return Response.json({
      indicadores: [
        { rotulo: 'Valor em estoque', valor: brl(i.valorEmEstoque), tom: 'destaque' },
        { rotulo: 'Materiais ativos', valor: String(i.totalMateriais), tom: 'neutro' },
        { rotulo: 'Sem estoque', valor: String(i.semEstoque), tom: i.semEstoque > 0 ? 'perigo' : 'bom' },
        { rotulo: 'Abaixo do mínimo', valor: String(i.abaixoDoMinimo), tom: i.abaixoDoMinimo > 0 ? 'alerta' : 'bom' },
        { rotulo: 'Entradas no mês', valor: String(i.entradasDoMes), tom: 'bom' },
        { rotulo: 'Saídas no mês', valor: String(i.saidasDoMes), tom: 'neutro' },
      ],
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.'
    return Response.json({ erro }, { status: 500 })
  }
}
