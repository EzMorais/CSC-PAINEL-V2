import { verificarTokenIntegracao } from '@/lib/integracao'
import { indicadores } from '@/queries/dashboard'

export const dynamic = 'force-dynamic'

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * Devolve indicadores já FORMATADOS, com rótulo e tom — o Portal não conhece as regras do
 * RH, e duplicá-las lá faria as duas cópias divergirem com o tempo.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const i = await indicadores()
    const cadastroIncompleto = i.semObra + i.semCargo

    return Response.json({
      indicadores: [
        { rotulo: 'Funcionários ativos', valor: String(i.ativos), tom: 'destaque' },
        { rotulo: 'Afastados', valor: String(i.afastados), tom: i.afastados > 0 ? 'alerta' : 'bom' },
        { rotulo: 'Em férias', valor: String(i.ferias), tom: 'neutro' },
        { rotulo: 'Admissões no mês', valor: String(i.admissoesDoMes), tom: 'bom' },
        { rotulo: 'Desligamentos no mês', valor: String(i.desligamentosDoMes), tom: i.desligamentosDoMes > 0 ? 'alerta' : 'neutro' },
        { rotulo: 'Cadastro incompleto', valor: String(cadastroIncompleto), tom: cadastroIncompleto > 0 ? 'perigo' : 'bom' },
      ],
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.'
    return Response.json({ erro }, { status: 500 })
  }
}
