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
  neutro:  'border-border',
  ativa:   'border-l-4 border-l-status-ativa',
  atencao: 'border-l-4 border-l-status-atencao',
  vencida: 'border-l-4 border-l-status-vencida',
  perdido: 'border-l-4 border-l-status-perdido',
} as const

export function KpiCard({ rotulo, valor, detalhe, tom = 'neutro', href, icone }: Props) {
  const conteudo = (
    <div className={`h-full rounded-lg border bg-card p-4 ${TONS[tom]} ${href ? 'transition-colors hover:bg-accent' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        {icone}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular sm:text-3xl">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{conteudo}</Link> : conteudo
}
