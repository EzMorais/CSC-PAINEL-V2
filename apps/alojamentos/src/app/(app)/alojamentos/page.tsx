import Link from 'next/link'
import { House, Plus, MapPin, Phone } from 'lucide-react'
import { listarAlojamentos } from '@/queries/alojamentos'
import { linkWhatsapp } from '@/lib/whatsapp'

export const metadata = { title: 'Alojamentos' }
export const dynamic = 'force-dynamic'

export default async function ListaAlojamentosPage() {
  const alojamentos = await listarAlojamentos()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Alojamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Onde a equipe mora durante a obra</p>
        </div>
        <Link
          href="/alojamentos/novo" data-testid="novo-alojamento"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Novo alojamento
        </Link>
      </header>

      {alojamentos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum alojamento cadastrado ainda.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="lista-alojamentos">
          {alojamentos.map((a) => {
            const vagas = Math.max(0, a.capacidade - a.ocupados)
            const zap = linkWhatsapp(a.telefoneResponsavel, `Olá! Sobre o alojamento ${a.nome}:`)
            return (
              <li key={a.id} className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm ${!a.ativo ? 'opacity-60' : ''}`}>
                <Link href={`/alojamentos/${a.id}`} className="block">
                  <span className="grid h-32 w-full place-items-center overflow-hidden bg-muted">
                    {a.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URI do banco
                      <img src={a.foto} alt="" className="size-full object-cover" />
                    ) : (
                      <House className="size-8 text-muted-foreground" />
                    )}
                  </span>
                </Link>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/alojamentos/${a.id}`} className="font-medium hover:underline">{a.nome}</Link>
                    {!a.ativo && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">Inativo</span>}
                  </div>

                  {(a.cidade || a.bairro) && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      {[a.bairro, a.cidade, a.uf].filter(Boolean).join(', ')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                    <span className="tabular">
                      <strong>{a.ocupados}</strong>
                      {a.capacidade > 0 && <span className="text-muted-foreground"> / {a.capacidade}</span>}
                      <span className="ml-1 text-xs text-muted-foreground">moradores</span>
                    </span>
                    {a.capacidade > 0 && (
                      <span className={`text-xs ${vagas === 0 ? 'text-status-atencao' : 'text-muted-foreground'}`}>
                        {vagas === 0 ? 'lotado' : `${vagas} vaga${vagas === 1 ? '' : 's'}`}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{a.quartos} quarto{a.quartos === 1 ? '' : 's'}</span>
                  </div>

                  {a.responsavelNome && (
                    <p className="text-xs text-muted-foreground">Responsável: {a.responsavelNome}</p>
                  )}
                  {zap && (
                    <a
                      href={zap} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Phone className="size-3.5" /> WhatsApp do responsável
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
