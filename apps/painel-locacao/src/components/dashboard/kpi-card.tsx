import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'ativa' | 'atencao' | 'vencida' | 'perdido'
  href?: string
  icone?: ReactNode
}

const TONS = {
  neutro:  { borda: 'border-border',                          chip: 'bg-muted text-muted-foreground' },
  ativa:   { borda: 'border-l-4 border-l-status-ativa',        chip: 'bg-status-ativa/15 text-status-ativa' },
  atencao: { borda: 'border-l-4 border-l-status-atencao',      chip: 'bg-status-atencao/15 text-status-atencao' },
  vencida: { borda: 'border-l-4 border-l-status-vencida',      chip: 'bg-status-vencida/15 text-status-vencida' },
  perdido: { borda: 'border-l-4 border-l-status-perdido',      chip: 'bg-status-perdido/15 text-status-perdido' },
} as const

export function KpiCard({ rotulo, valor, detalhe, tom = 'neutro', href, icone }: Props) {
  const t = TONS[tom]
  const conteudo = (
    <div
      className={`h-full rounded-lg border bg-card p-4 shadow-sm ${t.borda} ${
        href ? 'transition-all hover:-translate-y-0.5 hover:bg-accent hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        {icone && (
          <span className={`grid size-8 shrink-0 place-items-center rounded-md ${t.chip}`}>{icone}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular sm:text-3xl">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{conteudo}</Link> : conteudo
}
