import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { IconTile, type CorTile } from '@/components/ui/icon-tile'

type Props = {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'ativa' | 'atencao' | 'vencida' | 'perdido'
  href?: string
  icone?: LucideIcon
  /** R$ usa sempre a cor de money (DESIGN-SYSTEM.md §5) em vez do texto padrão. */
  moeda?: boolean
}

/* Cada status mapeia pra uma cor de tile — a cor sozinha carrega o significado, sem
   precisar da borda esquerda colorida que o card tinha antes (DESIGN-SYSTEM.md §5). */
const CORES: Record<NonNullable<Props['tom']>, CorTile> = {
  neutro: 'blue',
  ativa: 'green',
  atencao: 'yellow',
  vencida: 'red',
  perdido: 'purple',
}

export function KpiCard({ rotulo, valor, detalhe, tom = 'neutro', href, icone: Icone, moeda = false }: Props) {
  const conteudo = (
    <div
      className={`h-full rounded-lg border border-border bg-card p-4 shadow-xs transition-[transform,box-shadow,background-color] duration-(--duration-fast) ${
        href ? 'hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        {Icone && <IconTile icone={Icone} cor={CORES[tom]} />}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular sm:text-3xl ${moeda ? 'text-money' : ''}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{conteudo}</Link> : conteudo
}
