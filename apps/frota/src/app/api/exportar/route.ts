import { NextResponse } from 'next/server';
import { db, veiculos, manutencoes, abastecimentos, veiculosAutorizados } from '@/db';
import { lerSessao } from '@/lib/auth';
import { gerarPlanilha } from '@/lib/xlsx';

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new NextResponse('Não autenticado', { status: 401 });

  const buffer = await gerarPlanilha({
    veiculos: db.select().from(veiculos).all(),
    manutencoes: db.select().from(manutencoes).all(),
    abastecimentos: db.select().from(abastecimentos).all(),
    autorizados: db.select().from(veiculosAutorizados).all(),
  });

  const hoje = new Date();
  const nome = `Controle_Veiculos_${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getFullYear()).slice(2)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
