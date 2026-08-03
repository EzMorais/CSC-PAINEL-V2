import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Columns3, LogOut } from 'lucide-react'
import { lerSessao } from '@/lib/auth'
import { Marca } from '@/components/marca/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { sair } from '@/actions/auth'

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão. Isto cobre páginas, não Server Actions: cada action chama `exigirLancamento()`
 * por conta própria.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao()
  if (!sessao) redirect('/entrar')

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Marca className="size-8 shrink-0" />
            <span className="leading-tight">
              <span className="block font-semibold">Construtora Siqueira Campos</span>
              <span className="block text-xs text-muted-foreground">Programação diária</span>
            </span>
          </Link>

          <nav className="flex gap-1">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <CalendarDays className="size-4" /> Dias
            </Link>
            <Link
              href="/frentes"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Columns3 className="size-4" /> Clientes
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="truncate text-sm font-medium">{sessao.nome}</p>
              <p className="truncate text-xs text-muted-foreground">{sessao.email}</p>
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

      <main>{children}</main>
    </div>
  )
}
