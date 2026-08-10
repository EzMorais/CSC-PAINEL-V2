'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Package, Building2, Truck, Upload, Menu, X, LogOut,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Marca } from '@/components/marca/logo'
import { sair } from '@/actions/auth'

const ITENS = [
  { href: '/',              rotulo: 'Dashboard',    Icone: LayoutDashboard },
  { href: '/locacoes',      rotulo: 'Locações',     Icone: Package },
  { href: '/obras',         rotulo: 'Obras',        Icone: Building2 },
  { href: '/fornecedores',  rotulo: 'Fornecedores', Icone: Truck },
  { href: '/importar',      rotulo: 'Importar',     Icone: Upload },
]

const CHAVE_COLAPSADA = 'sidebar-colapsada'

type Usuario = { nome: string; email: string }

export function Sidebar({ usuario }: { usuario: Usuario }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [colapsado, setColapsado] = useState(false)
  const [pronto, setPronto] = useState(false)

  // Lido só depois de montar — evita descasamento de hidratação (servidor não sabe
  // o que está no localStorage do navegador).
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setColapsado(localStorage.getItem(CHAVE_COLAPSADA) === '1')
      setPronto(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  function alternarColapso() {
    setColapsado((v) => {
      localStorage.setItem(CHAVE_COLAPSADA, v ? '0' : '1')
      return !v
    })
  }

  const links = ITENS.map(({ href, rotulo, Icone }) => {
    const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href} href={href} onClick={() => setAberto(false)}
        aria-current={ativo ? 'page' : undefined}
        title={colapsado ? rotulo : undefined}
        className={`flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors duration-(--duration-fast) border-l-2 ${
          colapsado ? 'justify-center px-2.5' : 'px-3'
        } ${
          ativo
            ? 'border-l-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'border-l-transparent text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
        }`}
      >
        <Icone className="size-4 shrink-0" />
        {!colapsado && rotulo}
      </Link>
    )
  })

  return (
    <>
      {/* Barra superior — só no mobile */}
      <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
        <button
          type="button" onClick={() => setAberto(true)}
          aria-label="Abrir menu" aria-expanded={aberto}
          className="grid size-9 place-items-center rounded-md border border-sidebar-border text-sidebar-foreground"
        >
          <Menu className="size-4" />
        </button>
        <span className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <Marca className="size-6 shrink-0" /> Locação SC
        </span>
        <ThemeToggle />
      </header>

      {/* Overlay do menu no mobile */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAberto(false)} aria-hidden />
      )}

      <nav
        data-testid="navegacao"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4
                    transition-transform duration-(--duration-base) lg:static lg:translate-x-0
                    ${aberto ? 'translate-x-0' : '-translate-x-full'}
                    ${pronto && colapsado ? 'lg:w-16 lg:p-2.5' : ''}`}
      >
        <div className={`mb-6 flex items-center ${colapsado ? 'flex-col gap-3' : 'justify-between'}`}>
          <div className={`flex items-center gap-2 ${colapsado ? 'flex-col' : ''}`}>
            <Marca className="size-8 shrink-0" />
            {!colapsado && (
              <div>
                <p className="font-semibold leading-tight text-sidebar-foreground">Siqueira Campos</p>
                <p className="text-xs text-sidebar-muted-foreground">Painel de Locação</p>
              </div>
            )}
          </div>
          <button
            type="button" onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="grid size-8 place-items-center rounded-md border border-sidebar-border text-sidebar-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>

        <div className="space-y-1">{links}</div>

        {/* mt-auto empurra para o rodapé da navegação, em qualquer altura de tela */}
        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-3">
          {!colapsado && (
            <div className="px-3 pb-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground" title={usuario.nome}>
                {usuario.nome}
              </p>
              <p className="truncate text-xs text-sidebar-muted-foreground" title={usuario.email}>
                {usuario.email}
              </p>
            </div>
          )}
          <form action={sair}>
            <button
              type="submit"
              data-testid="sair"
              title={colapsado ? 'Sair' : undefined}
              className={`flex w-full items-center gap-3 rounded-md py-2.5 text-sm
                         text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground
                         ${colapsado ? 'justify-center px-2.5' : 'px-3'}`}
            >
              <LogOut className="size-4 shrink-0" />
              {!colapsado && 'Sair'}
            </button>
          </form>

          {/* Collapse — só existe no desktop, o drawer do mobile não colapsa. */}
          <button
            type="button" onClick={alternarColapso}
            aria-label={colapsado ? 'Expandir menu' : 'Recolher menu'}
            className={`hidden w-full items-center gap-3 rounded-md py-2.5 text-sm
                       text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex
                       ${colapsado ? 'justify-center px-2.5' : 'px-3'}`}
          >
            {colapsado ? <ChevronsRight className="size-4 shrink-0" /> : <ChevronsLeft className="size-4 shrink-0" />}
            {!colapsado && 'Recolher'}
          </button>
        </div>
      </nav>
    </>
  )
}
