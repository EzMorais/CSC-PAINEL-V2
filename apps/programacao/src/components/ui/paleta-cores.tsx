'use client'

export type OpcaoCor = { nome: string; valor: string }

export function PaletaCores({
  cores, valor, onChange, rotulo = 'Paleta de cores',
}: {
  cores: OpcaoCor[]
  valor: string
  onChange: (cor: string) => void
  rotulo?: string
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12" role="radiogroup" aria-label={rotulo}>
        {cores.map((cor) => (
          <button
            key={cor.valor}
            type="button"
            title={cor.nome}
            aria-label={`${cor.nome}${valor === cor.valor ? ' (selecionada)' : ''}`}
            aria-pressed={valor === cor.valor}
            onClick={() => onChange(cor.valor)}
            className={`size-7 rounded border-2 shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              valor === cor.valor ? 'scale-110 border-foreground ring-1 ring-foreground/30' : 'border-border'
            }`}
            style={{ backgroundColor: cor.valor }}
          />
        ))}
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#ffffff'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label="Escolher cor personalizada"
          className="size-7 cursor-pointer rounded border border-border bg-background p-0.5"
        />
        Escolher outra cor
      </label>
    </div>
  )
}
