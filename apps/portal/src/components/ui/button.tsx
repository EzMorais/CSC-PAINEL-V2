import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTES: Record<Variante, string> = {
  primary:
    'border-2 border-primary bg-primary text-primary-foreground shadow-[4px_4px_0_var(--primary)] hover:-translate-y-0.5',
  secondary:
    'border-2 border-border bg-card text-foreground shadow-[4px_4px_0_var(--border)] hover:bg-accent',
  danger:
    'border-2 border-destructive bg-destructive text-destructive-foreground shadow-[4px_4px_0_var(--destructive)] hover:-translate-y-0.5',
  ghost:
    'text-muted-foreground hover:bg-accent hover:text-foreground',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] ' +
  'transition-[transform,background-color,box-shadow,filter] duration-(--duration-fast) ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Botão base do sistema — ver DESIGN-SYSTEM.md §5. `primary` usa a cor de identidade
 * do app (`--primary`), `danger` é sempre vermelho independente do app.
 */
export function Button({
  variante = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props} />
}
