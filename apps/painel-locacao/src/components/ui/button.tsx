import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTES: Record<Variante, string> = {
  primary:
    'bg-primary text-primary-foreground hover:brightness-[1.08] shadow-xs',
  secondary:
    'bg-card text-foreground border border-border hover:bg-accent shadow-xs',
  danger:
    'bg-destructive text-destructive-foreground hover:brightness-[1.08] shadow-xs',
  ghost:
    'text-muted-foreground hover:bg-accent hover:text-foreground',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium ' +
  'transition-[background-color,box-shadow,filter] duration-(--duration-fast) ' +
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
