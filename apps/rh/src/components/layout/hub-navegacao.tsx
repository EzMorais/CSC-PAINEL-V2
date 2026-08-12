'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid, Building2, Users, Package, House, Truck, FolderKanban, CalendarDays, Check, X,
  Settings2, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw,
} from 'lucide-react'

/** Mesmo host, portas diferentes — a sessão do Portal vale em todos. */
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3004'
const URL_PROGRAMACAO = process.env.NEXT_PUBLIC_URL_PROGRAMACAO ?? 'http://localhost:3007'
const URL_PAINEL = process.env.NEXT_PUBLIC_URL_PAINEL ?? 'http://localhost:3001'
const URL_RH = process.env.NEXT_PUBLIC_URL_RH ?? 'http://localhost:3002'
const URL_ESTOQUE = process.env.NEXT_PUBLIC_URL_ESTOQUE ?? 'http://localhost:3003'
const URL_ALOJAMENTOS = process.env.NEXT_PUBLIC_URL_ALOJAMENTOS ?? 'http://localhost:3005'
const URL_FROTA = process.env.NEXT_PUBLIC_URL_FROTA ?? 'http://localhost:3000'

type Sistema =
  | 'PORTAL' | 'CADASTROS' | 'PROGRAMACAO' | 'PAINEL' | 'RH' | 'ESTOQUE' | 'ALOJAMENTOS' | 'FROTA'

const ITENS: { chave: Sistema; rotulo: string; Icone: typeof LayoutGrid; url: string; modulo?: string }[] = [
  { chave: 'PORTAL', rotulo: 'Portal', Icone: LayoutGrid, url: URL_PORTAL },
  { chave: 'PROGRAMACAO', rotulo: 'Programação diária', Icone: CalendarDays, url: URL_PROGRAMACAO, modulo: 'PROGRAMACAO' },
  { chave: 'CADASTROS', rotulo: 'Cadastros', Icone: FolderKanban, url: `${URL_PORTAL}/cadastros`, modulo: 'CADASTROS' },
  { chave: 'PAINEL', rotulo: 'Painel de Locação', Icone: Building2, url: URL_PAINEL, modulo: 'PAINEL' },
  { chave: 'RH', rotulo: 'RH e SST', Icone: Users, url: URL_RH, modulo: 'RH' },
  { chave: 'ESTOQUE', rotulo: 'Almoxarifado', Icone: Package, url: URL_ESTOQUE, modulo: 'ESTOQUE' },
  { chave: 'ALOJAMENTOS', rotulo: 'Alojamentos', Icone: House, url: URL_ALOJAMENTOS, modulo: 'ALOJAMENTOS' },
  { chave: 'FROTA', rotulo: 'Frota', Icone: Truck, url: URL_FROTA, modulo: 'FROTA' },
]

/** Chave do localStorage — mesmo nome em todos os apps, pra funcionar se algum dia
 * convergirem pro mesmo host (o gateway Go já serve vários sob o mesmo domínio). */
const CHAVE_PREFERENCIAS = 'csc-hub-preferencias'

type Preferencias = { ordem: Sistema[]; ocultos: Sistema[] }

function lerPreferencias(): Preferencias | null {
  try {
    const bruto = localStorage.getItem(CHAVE_PREFERENCIAS)
    if (!bruto) return null
    const dado = JSON.parse(bruto)
    if (!Array.isArray(dado?.ordem) || !Array.isArray(dado?.ocultos)) return null
    return { ordem: dado.ordem, ocultos: dado.ocultos }
  } catch {
    return null
  }
}

function salvarPreferencias(p: Preferencias) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p))
  } catch {
    // Modo privado ou armazenamento cheio — a personalização simplesmente não persiste.
  }
}

/**
 * Hub flutuante de navegação entre os sistemas do Portal.
 *
 * Fica recolhido por padrão (só o botão) e só mostra os sistemas que o cargo de fato
 * alcança — Consulta num só módulo não vê os outros três na lista, por exemplo. ADMIN e
 * DIRETORIA enxergam tudo, igual à regra do Portal. Além da permissão (do servidor, fixa),
 * a pessoa pode esconder e reordenar os itens que ela PODE ver — preferência de exibição
 * salva no navegador (`localStorage`), não muda o que está liberado.
 */
export function HubNavegacao({
  cargo, modulos, atual,
}: {
  cargo: string
  modulos: string[]
  atual: Sistema
}) {
  const [aberto, setAberto] = useState(false)
  const [personalizando, setPersonalizando] = useState(false)
  // null até o efeito ler o localStorage (evita descasamento de hidratação — o servidor não
  // tem acesso a essa API). Enquanto null, usa a ordem/visibilidade padrão.
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPreferencias(lerPreferencias())
  }, [])

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

  useEffect(() => {
    if (!aberto) setPersonalizando(false)
  }, [aberto])

  const vePor = cargo === 'ADMIN' || cargo === 'DIRETORIA'
  const liberados = ITENS.filter((i) => !i.modulo || vePor || modulos.includes(i.modulo))

  const porChave = new Map(liberados.map((i) => [i.chave, i]))
  const ordemSalva = (preferencias?.ordem ?? []).filter((c) => porChave.has(c))
  const ordenados = [
    ...ordemSalva.map((c) => porChave.get(c)!),
    ...liberados.filter((i) => !ordemSalva.includes(i.chave)),
  ]
  const ocultosSet = new Set(preferencias?.ocultos ?? [])
  const itensVisiveis = ordenados.filter((i) => i.chave === atual || !ocultosSet.has(i.chave))

  function persistir(ordem: Sistema[], ocultos: Sistema[]) {
    const novo = { ordem, ocultos }
    setPreferencias(novo)
    salvarPreferencias(novo)
  }

  function mover(chave: Sistema, direcao: -1 | 1) {
    const ordem = ordenados.map((i) => i.chave)
    const idx = ordem.indexOf(chave)
    const novoIdx = idx + direcao
    if (novoIdx < 0 || novoIdx >= ordem.length) return
    ;[ordem[idx], ordem[novoIdx]] = [ordem[novoIdx], ordem[idx]]
    persistir(ordem, [...ocultosSet])
  }

  function alternarOculto(chave: Sistema) {
    const ocultos = ocultosSet.has(chave)
      ? [...ocultosSet].filter((c) => c !== chave)
      : [...ocultosSet, chave]
    persistir(ordenados.map((i) => i.chave), ocultos)
  }

  function restaurarPadrao() {
    setPreferencias({ ordem: [], ocultos: [] })
    try { localStorage.removeItem(CHAVE_PREFERENCIAS) } catch { /* ignora */ }
  }

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50">
      {aberto && (
        <div
          role="menu" aria-label="Navegação rápida entre sistemas"
          className="absolute bottom-14 right-0 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              {personalizando ? 'Personalizar exibição' : 'Sistemas Construtora Siqueira Campos'}
            </p>
            <button
              type="button"
              onClick={() => setPersonalizando((v) => !v)}
              aria-pressed={personalizando}
              aria-label={personalizando ? 'Concluir personalização' : 'Personalizar exibição do hub'}
              className={`grid size-6 shrink-0 place-items-center rounded transition-colors ${personalizando ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              <Settings2 className="size-3.5" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1">
            {!personalizando && itensVisiveis.map(({ chave, rotulo, Icone, url }) =>
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

            {personalizando && ordenados.map(({ chave, rotulo, Icone }, indice) => {
              const oculto = chave !== atual && ocultosSet.has(chave)
              return (
                <div
                  key={chave}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm ${oculto ? 'text-muted-foreground/50' : 'text-foreground'}`}
                >
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button" onClick={() => mover(chave, -1)} disabled={indice === 0}
                      aria-label={`Mover ${rotulo} para cima`}
                      className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button" onClick={() => mover(chave, 1)} disabled={indice === ordenados.length - 1}
                      aria-label={`Mover ${rotulo} para baixo`}
                      className="grid size-4 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                  <Icone className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                  <button
                    type="button"
                    onClick={() => alternarOculto(chave)}
                    disabled={chave === atual}
                    aria-label={oculto ? `Mostrar ${rotulo}` : `Esconder ${rotulo}`}
                    aria-pressed={!oculto}
                    title={chave === atual ? 'O módulo atual sempre aparece' : undefined}
                    className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    {oculto ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              )
            })}
          </div>

          {personalizando && (
            <div className="border-t border-border p-1">
              <button
                type="button" onClick={restaurarPadrao}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Restaurar padrão
              </button>
            </div>
          )}
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
