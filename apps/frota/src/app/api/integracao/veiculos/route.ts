import { db, veiculos as tVeiculos, manutencoes as tManut } from '@/db';
import { verificarTokenIntegracao } from '@/lib/integracao';

export const dynamic = 'force-dynamic';

/**
 * A frota para os outros módulos — hoje, para a Programação montar o quadro do dia.
 *
 * Vai junto se o veículo tem manutenção em aberto, e não só a lista de placas. É a diferença
 * entre o quadro deixar escalar um carro que está na oficina e avisar antes: quem monta a
 * programação à noite não tem como saber o que a manutenção registrou de manhã.
 *
 * Devolve o mínimo para escalar — placa, nome, motorista habitual. Sem seguro, FIPE, multas
 * ou km: são da gestão da frota, não de quem decide quem vai para qual obra.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'));
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 });
  }

  try {
    const lista = db.select().from(tVeiculos).all();
    const manuts = db.select().from(tManut).all();

    // Uma placa pode ter várias manutenções abertas; interessa se tem alguma.
    const emManutencao = new Map<string, string>();
    for (const m of manuts) {
      if (m.status === 'Concluído' || !m.placa) continue;
      if (!emManutencao.has(m.placa)) emManutencao.set(m.placa, m.problema);
    }

    return Response.json({
      veiculos: lista
        .filter((v) => v.placa && v.placa !== '-')
        .map((v) => ({
          placa: v.placa,
          nome: v.nome,
          motorista: v.motorista || null,
          emManutencao: emManutencao.has(v.placa),
          motivoManutencao: emManutencao.get(v.placa) ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    });
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao listar os veículos.';
    return Response.json({ erro }, { status: 500 });
  }
}
