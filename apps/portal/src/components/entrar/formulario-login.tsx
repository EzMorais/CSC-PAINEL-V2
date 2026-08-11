'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from '@/actions/auth'

const CAMPO =
  'w-full rounded-sm border-2 border-black/15 bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, null)

  return (
    <main className="tela-login-fundo grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem decorativa fixa */}
          <img src="/marca-completa.png" alt="Construtora Siqueira Campos" className="h-16 w-auto" />
          <p className="border-y-2 border-marca-vermelho px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
            Portal dos sistemas
          </p>
        </div>

        <form action={acao} className="space-y-4 border-2 border-black/15 bg-card p-6 shadow-[8px_8px_0_var(--marca-azul)]">
          <input type="hidden" name="destino" value={destino} />

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em]">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              placeholder="voce@siqueiracampos.com.br"
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em]">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className={CAMPO}
            />
          </div>

          {estado?.erro && (
            <p role="alert" data-testid="erro-login" className="border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {estado.erro}
            </p>
          )}

          <button
            type="submit"
            disabled={pendente}
            className="w-full border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-50"
          >
            {pendente ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Uma senha so para todos os sistemas: Painel de Locacao, RH, Almoxarifado e Frota.
        </p>
      </div>
    </main>
  )
}
