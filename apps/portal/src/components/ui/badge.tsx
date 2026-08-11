import type { ReactNode } from 'react'

type Tom = 'neutro' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

const TONS: Record<Tom, string> = {
  neutro: 'bg-muted text-muted-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive/15 text-destructive',
  info: 'bg-info-soft text-info',
  purple: 'bg-purple-soft text-purple',
}

/** Badge do sistema — fundo `*-soft`, texto saturado, pill. Ver DESIGN-SYSTEM.md §5. */
export function Badge({ tom = 'neutro', icone, children }: { tom?: Tom; icone?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${TONS[tom]}`}>
      {icone}
      {children}
    </span>
  )
}
