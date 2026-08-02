'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Package, ArrowLeftRight, ShoppingCart, Building2, Truck, BarChart3,
  Menu, X, LogOut, ExternalLink,
} from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { sair } from '@/actions/auth'

const ITENS = [
  { href: '/',              rotulo: 'Dashboard',     Icone: LayoutDashboard },
  { href: '/materiais',     rotulo: 'Materiais',     Icone: Package },
  { href: '/movimentacoes', rotulo: 'Movimentações', Icone: ArrowLeftRight },
  { href: '/solicitacoes',  rotulo: 'Compras',       Icone: ShoppingCart },
  { href: '/obras',         rotulo: 'Obras',         Icone: Building2 },
  { href: '/fornecedores',  rotulo: 'Fornecedores',  Icone: Truck },
  { href: '/relatorios',    rotulo: 'Relatórios',    Icone: BarChart3 },
]

/** Onde os outros módulos respondem. Mesmo host, outra porta — a sessão vale em todos. */
const URL_PAINEL = process.env.NEXT_PUBLIC_URL_PAINEL ?? 'http://localhost:3000'
const URL_RH_PUBLICA = process.env.NEXT_PUBLIC_URL_RH ?? 'http://localhost:3002'

type Usuario = { nome: string; email: string }

export function Sidebar({ usuario }: { usuario: Usuario }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  const links = ITENS.map(({ href, rotulo, Icone }) => {
    const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href} href={href} onClick={() => setAberto(false)}
        aria-current={ativo ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          ativo ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <Icone className="size-4 shrink-0" />
        {rotulo}
      </Link>
    )
  })

  return (
    <>
      {/* Barra superior — só no mobile */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <button
          type="button" onClick={() => setAberto(true)}
          aria-label="Abrir menu" aria-expanded={aberto}
          className="grid size-9 place-items-center rounded-md border border-border"
        >
          <Menu className="size-4" />
        </button>
        <span className="font-semibold">Almoxarifado</span>
        <ThemeToggle />
      </header>

      {/* Overlay do menu no mobile */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAberto(false)} aria-hidden />
      )}

      <nav
        data-testid="navegacao"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-border bg-card p-4
                    transition-transform lg:static lg:translate-x-0
                    ${aberto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold leading-tight">Siqueira Campos</p>
            <p className="text-xs text-muted-foreground">Almoxarifado</p>
          </div>
          <button
            type="button" onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="grid size-8 place-items-center rounded-md border border-border lg:hidden"
          >
            <X className="size-4" />
          </button>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>

        <div className="space-y-1">{links}</div>

        {/* mt-auto empurra para o rodapé da navegação, em qualquer altura de tela */}
        <div className="mt-auto space-y-2 border-t border-border pt-4">
          <a
            href={URL_PAINEL}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground
                       transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-4 shrink-0" />
            Painel de Locação
          </a>
          <a
            href={`${URL_RH_PUBLICA}/epis`}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground
                       transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-4 shrink-0" />
            Fichas de EPI (RH)
          </a>

          <div className="px-3 pt-2">
            <p className="truncate text-sm font-medium" title={usuario.nome}>{usuario.nome}</p>
            <p className="truncate text-xs text-muted-foreground" title={usuario.email}>{usuario.email}</p>
          </div>
          <form action={sair}>
            <button
              type="submit"
              data-testid="sair"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm
                         text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" />
              Sair
            </button>
          </form>
        </div>
      </nav>
    </>
  )
}
