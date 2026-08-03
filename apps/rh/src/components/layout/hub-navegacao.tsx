'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Building2, Users, Package, House, Check, X } from 'lucide-react'

/** Mesmo host, portas diferentes — a sessão do Portal vale nos quatro. */
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3004'
const URL_PAINEL = process.env.NEXT_PUBLIC_URL_PAINEL ?? 'http://localhost:3001'
const URL_RH = process.env.NEXT_PUBLIC_URL_RH ?? 'http://localhost:3002'
const URL_ESTOQUE = process.env.NEXT_PUBLIC_URL_ESTOQUE ?? 'http://localhost:3003'
const URL_ALOJAMENTOS = process.env.NEXT_PUBLIC_URL_ALOJAMENTOS ?? 'http://localhost:3005'

type Sistema = 'PORTAL' | 'PAINEL' | 'RH' | 'ESTOQUE' | 'ALOJAMENTOS'

const ITENS: { chave: Sistema; rotulo: string; Icone: typeof LayoutGrid; url: string; modulo?: string }[] = [
  { chave: 'PORTAL', rotulo: 'Portal', Icone: LayoutGrid, url: URL_PORTAL },
  { chave: 'PAINEL', rotulo: 'Painel de Locação', Icone: Building2, url: URL_PAINEL, modulo: 'PAINEL' },
  { chave: 'RH', rotulo: 'RH e SST', Icone: Users, url: URL_RH, modulo: 'RH' },
  { chave: 'ESTOQUE', rotulo: 'Almoxarifado', Icone: Package, url: URL_ESTOQUE, modulo: 'ESTOQUE' },
  { chave: 'ALOJAMENTOS', rotulo: 'Alojamentos', Icone: House, url: URL_ALOJAMENTOS, modulo: 'ALOJAMENTOS' },
]

/**
 * Hub flutuante de navegação entre os sistemas do Portal.
 *
 * Fica recolhido por padrão (só o botão) e só mostra os sistemas que o cargo de fato
 * alcança — Consulta num só módulo não vê os outros três na lista, por exemplo. ADMIN e
 * DIRETORIA enxergam tudo, igual à regra do Portal.
 */
export function HubNavegacao({
  cargo, modulos, atual,
}: {
  cargo: string
  modulos: string[]
  atual: Sistema
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  const vePor = cargo === 'ADMIN' || cargo === 'DIRETORIA'
  const itens = ITENS.filter((i) => !i.modulo || vePor || modulos.includes(i.modulo))

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50">
      {aberto && (
        <div
          role="menu" aria-label="Navegação rápida entre sistemas"
          className="absolute bottom-14 right-0 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Sistemas Siqueira Campos
          </p>
          <div className="p-1">
            {itens.map(({ chave, rotulo, Icone, url }) =>
              chave === atual ? (
                <span key={chave} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium">
                  <Icone className="size-4 shrink-0" />
                  {rotulo}
                  <Check className="ml-auto size-4 shrink-0 text-primary" />
                </span>
              ) : (
                <a
                  key={chave} href={url}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground
                             transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icone className="size-4 shrink-0" />
                  {rotulo}
                </a>
              ),
            )}
          </div>
        </div>
      )}

      <button
        type="button" onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? 'Fechar navegação rápida' : 'Abrir navegação rápida'}
        aria-expanded={aberto} data-testid="hub-navegacao-botao"
        className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground
                   shadow-lg transition-transform hover:scale-105"
      >
        {aberto ? <X className="size-5" /> : <LayoutGrid className="size-5" />}
      </button>
    </div>
  )
}
