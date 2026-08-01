'use client'

import { useActionState } from 'react'
import { Package } from 'lucide-react'
import { entrar, type EstadoLogin } from '@/actions/auth'

export function FormularioLogin() {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, null)

  const campo =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
    'outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Package className="size-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Siqueira Campos</p>
            <p className="text-xs text-muted-foreground">Painel de Locação</p>
          </div>
        </div>

        <form
          action={acao}
          className="space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
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
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className={campo}
            />
          </div>

          {estado?.erro && (
            <p
              role="alert"
              data-testid="erro-login"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {estado.erro}
            </p>
          )}

          <button
            type="submit"
            disabled={pendente}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pendente ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Acesso restrito. O painel mostra custo de obra e valores por fornecedor.
        </p>
      </div>
    </main>
  )
}
