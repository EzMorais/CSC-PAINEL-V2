'use client';

import { useActionState } from 'react';
import { entrar } from '../acoes';

export default function Entrar() {
  const [estado, acao, pendente] = useActionState(entrar, null as { erro?: string } | null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-barra px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 border-2 border-barra-700 bg-barra px-4 py-4 text-left shadow-[6px_6px_0_rgb(18_22_28_/_0.45)]">
          <div className="flex items-baseline gap-2">
            <span className="h-3 w-3 rounded-sm bg-hivis shadow-[3px_3px_0_rgb(18_22_28_/_0.45)]" aria-hidden />
            <span className="rotulo text-lg text-barra-texto">Frota</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-barra-suave/70">
            Construtora Siqueira Campos
          </p>
        </div>

        <form action={acao} className="space-y-4 border-2 border-black/20 bg-superficie p-6 shadow-[8px_8px_0_rgb(18_22_28_/_0.16)]">
          <div>
            <label htmlFor="email" className="rotulo-campo">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="campo"
              placeholder="voce@siqueiracampos.com.br"
            />
          </div>

          <div>
            <label htmlFor="senha" className="rotulo-campo">Senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className="campo"
            />
          </div>

          {estado?.erro && (
            <p role="alert" className="border-2 border-sinal bg-sinal-fraco px-3 py-2 text-sm text-sinal">
              {estado.erro}
            </p>
          )}

          <button type="submit" disabled={pendente} className="botao-primario w-full">
            {pendente ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
