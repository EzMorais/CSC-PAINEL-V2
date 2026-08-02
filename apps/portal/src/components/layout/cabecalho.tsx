'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, LogOut, Users } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { sair } from '@/actions/auth'
import { ROTULO_CARGO, type Cargo } from '@/lib/dominio/cargos'

export function Cabecalho({
  usuario, ehAdmin,
}: {
  usuario: { nome: string; email: string; cargo: string }
  ehAdmin: boolean
}) {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="size-4" />
          </span>
          <span className="font-semibold leading-tight">Siqueira Campos</span>
        </Link>

        {ehAdmin && (
          <nav className="flex gap-1">
            <Link
              href="/usuarios"
              aria-current={pathname.startsWith('/usuarios') ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith('/usuarios')
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Users className="size-4" /> Usuários
            </Link>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="truncate text-sm font-medium" title={usuario.nome}>{usuario.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROTULO_CARGO[usuario.cargo as Cargo] ?? usuario.cargo}
            </p>
          </div>
          <ThemeToggle />
          <form action={sair}>
            <button
              type="submit" data-testid="sair" aria-label="Sair"
              className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
