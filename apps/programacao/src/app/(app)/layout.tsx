import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Columns3, LogOut, Users, Truck } from 'lucide-react'
import { lerSessao } from '@/lib/auth'
import { Marca } from '@/components/marca/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { HubNavegacao } from '@/components/layout/hub-navegacao'
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
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Marca className="size-8 shrink-0" />
            <span className="leading-tight">
              <span className="block font-semibold">Construtora Siqueira Campos</span>
              <span className="block text-xs text-muted-foreground">Programação diária</span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <CalendarDays className="size-4" /> Dias
            </Link>
            <Link
              href="/frentes"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Columns3 className="size-4" /> Clientes
            </Link>
            <Link
              href="/funcionarios"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Users className="size-4" /> Funcionários
            </Link>
            <Link
              href="/veiculos"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Truck className="size-4" /> Veículos
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
                className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <HubNavegacao cargo={sessao.cargo} modulos={sessao.modulos} atual="PROGRAMACAO" />
    </div>
  )
}
