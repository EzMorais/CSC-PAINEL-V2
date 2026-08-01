import { Construction } from 'lucide-react'

/**
 * Marcador honesto para as seções que ainda não existem.
 *
 * O menu lista as 12 seções do módulo desde a Etapa 1 de propósito — esconder as que
 * faltam daria a impressão de um módulo menor do que o planejado. Mas apontar um link
 * para o vazio daria 404, então cada seção pendente responde com isto, dizendo o que
 * ela vai ser e que ainda não é.
 */
export function EmConstrucao({ titulo, descricao, itens }: { titulo: string; descricao: string; itens: string[] }) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </header>

      <div className="rounded-lg border border-dashed border-border p-6">
        <div className="flex items-start gap-3">
          <Construction className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">Ainda não implementado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta seção entra numa próxima etapa. O que está previsto:
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {itens.map((i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground/50">·</span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
