'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Users, LayoutDashboard, FolderKanban } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Marca } from '@/components/marca/logo'
import { sair } from '@/actions/auth'
import { ROTULO_CARGO, type Cargo } from '@/lib/dominio/cargos'

export function Cabecalho({
  usuario, ehAdmin, veCadastros,
}: {
  usuario: { nome: string; email: string; cargo: string }
  ehAdmin: boolean
  veCadastros: boolean
}) {
  const pathname = usePathname()

  const itens = [
    { href: '/dashboard', rotulo: 'Dashboard', Icone: LayoutDashboard, visivel: true },
    { href: '/cadastros', rotulo: 'Cadastros', Icone: FolderKanban, visivel: veCadastros },
    { href: '/usuarios', rotulo: 'Usuários', Icone: Users, visivel: ehAdmin },
  ].filter((i) => i.visivel)

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Marca className="size-8 shrink-0" />
          <span className="font-semibold leading-tight">Construtora Siqueira Campos</span>
        </Link>

        <nav className="flex flex-wrap gap-1">
          {itens.map(({ href, rotulo, Icone }) => {
            const atual = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={atual ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  atual
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icone className="size-4" /> {rotulo}
              </Link>
            )
          })}
        </nav>

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
