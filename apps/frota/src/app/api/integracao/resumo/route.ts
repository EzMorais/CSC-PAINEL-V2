import { db, veiculos as tVeiculos, manutencoes as tManut } from '@/db';
import { verificarTokenIntegracao } from '@/lib/integracao';
import { montarAlertas, brl } from '@/lib/frota';

export const dynamic = 'force-dynamic';

/**
 * Resumo deste módulo para o dashboard geral do Portal.
 *
 * Devolve indicadores já FORMATADOS, com rótulo e tom. O Portal não sabe o que torna uma
 * revisão "vencida" nem quando um seguro entra em alerta — reimplementar isso lá criaria
 * duas versões da mesma regra, e a do Portal envelheceria em silêncio.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'));
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 });
  }

  try {
    const veics = db.select().from(tVeiculos).all();
    const manuts = db.select().from(tManut).all();

    const alertas = montarAlertas(veics, manuts);
    const alertasAltos = alertas.filter((a) => a.gravidade === 'alta').length;
    const abertos = manuts.filter((m) => m.status === 'Aberto').length;
    const andamento = manuts.filter((m) => m.status === 'Em andamento').length;
    const multas = veics.reduce((s, v) => s + (v.multas || 0), 0);

    return Response.json({
      indicadores: [
        { rotulo: 'Veículos', valor: String(veics.length), tom: 'destaque' },
        { rotulo: 'Alertas graves', valor: String(alertasAltos), tom: alertasAltos > 0 ? 'perigo' : 'bom' },
        { rotulo: 'Alertas totais', valor: String(alertas.length), tom: alertas.length > 0 ? 'alerta' : 'bom' },
        { rotulo: 'Manutenções abertas', valor: String(abertos), tom: abertos > 0 ? 'perigo' : 'bom' },
        { rotulo: 'Em andamento', valor: String(andamento), tom: 'alerta' },
        { rotulo: 'Multas pendentes', valor: brl(multas, 2), tom: multas > 0 ? 'alerta' : 'bom' },
      ],
    });
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao montar o resumo.';
    return Response.json({ erro }, { status: 500 });
  }
}
