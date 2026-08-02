'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from '@/actions/auth'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, null)

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem decorativa fixa, sem necessidade de otimização do next/image */}
          <img src="/marca-completa.png" alt="Construtora Siqueira Campos" className="h-16 w-auto" />
          <p className="text-sm text-muted-foreground">Portal dos sistemas</p>
        </div>

        <form action={acao} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <input type="hidden" name="destino" value={destino} />

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              id="email" name="email" type="email" required autoComplete="username" autoFocus
              placeholder="voce@siqueiracampos.com.br" className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha</label>
            <input
              id="senha" name="senha" type="password" required autoComplete="current-password"
              className={CAMPO}
            />
          </div>

          {estado?.erro && (
            <p role="alert" data-testid="erro-login" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {estado.erro}
            </p>
          )}

          <button
            type="submit" disabled={pendente}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pendente ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Uma senha só para todos os sistemas: Painel de Locação, RH, Almoxarifado e Frota.
        </p>
      </div>
    </main>
  )
}
