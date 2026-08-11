import { NextResponse } from 'next/server';
import { encerrarSessao, urlDeLogin } from '@/lib/auth';

/**
 * Sair encerra a sessão de TODOS os módulos, não só deste — mesmo cookie compartilhado.
 * Ver `apps/rh/src/actions/auth.ts` para o mesmo padrão.
 */
export async function POST() {
  await encerrarSessao();
  return NextResponse.redirect(urlDeLogin('/'), { status: 303 });
}
