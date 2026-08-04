import type { LucideIcon } from 'lucide-react'

export type CorTile =
  | 'blue' | 'purple' | 'cyan' | 'orange' | 'green' | 'red' | 'yellow' | 'pink' | 'neutro'

const TAMANHOS = {
  sm: 'size-7 [&_svg]:size-3.5',
  md: 'size-8 [&_svg]:size-4',
  lg: 'size-10 [&_svg]:size-5',
} as const

/**
 * Tile de ícone "soft 3D minimal": gradiente 140°, inset highlight, sombra neutra
 * (--tile-shadow). Zero glow — ver DESIGN-SYSTEM.md §5. Usado em KPIs, atalhos e
 * qualquer lugar que hoje usa um "chip" de ícone colorido flat.
 */
export function IconTile({
  icone: Icone,
  cor = 'neutro',
  tamanho = 'md',
}: {
  icone: LucideIcon
  cor?: CorTile
  tamanho?: keyof typeof TAMANHOS
}) {
  return (
    <span
      className={`ic-tile ${TAMANHOS[tamanho]}`}
      style={{ background: `var(--ic-${cor}-grad)` }}
      aria-hidden
    >
      <Icone strokeWidth={2} />
    </span>
  )
}
