import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Phone, Pencil, House } from 'lucide-react'
import { obterAlojamento } from '@/queries/alojamentos'
import { PainelQuartos } from '@/components/alojamentos/painel-quartos'
import { SeloTransporte } from '@/components/selo'
import { linkWhatsapp } from '@/lib/whatsapp'
import { urlMapaEstatico } from '@/lib/geo'
import { dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function AlojamentoPage({ params }: Props) {
  const { id } = await params
  const a = await obterAlojamento(id)
  if (!a) notFound()

  const capacidade = a.quartos.length > 0
    ? a.quartos.filter((q) => q.ativo).reduce((s, q) => s + q.capacidade, 0)
    : a.capacidadeTotal ?? 0
  const ocupados = a.alocacoes.length
  const endereco = [
    [a.logradouro, a.numero].filter(Boolean).join(', '),
    a.bairro, [a.cidade, a.uf].filter(Boolean).join(' - '), a.cep,
  ].filter(Boolean).join(', ')
  const zap = linkWhatsapp(a.telefoneResponsavel, `Olá! Sobre o alojamento ${a.nome}:`)
  const mapa = a.lat != null && a.lng != null ? urlMapaEstatico(a.lat, a.lng) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/alojamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Alojamentos
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="nome-alojamento">{a.nome}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular">{ocupados}{capacidade > 0 && ` / ${capacidade}`} moradores</span>
              {endereco && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {endereco}</span>}
              {!a.ativo && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Inativo</span>}
            </p>
          </div>
          <Link
            href={`/alojamentos/${a.id}/editar`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            <Pencil className="size-4" /> Editar
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <PainelQuartos
              alojamentoId={a.id}
              quartos={a.quartos.map((q) => ({
                id: q.id, numero: q.numero, capacidade: q.capacidade,
                tipo: q.tipo, ativo: q.ativo, ocupados: q._count.alocacoes,
              }))}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">Moradores</h2>
              <Link href="/moradores/novo" className="text-xs text-primary hover:underline">alocar alguém</Link>
            </div>
            {a.alocacoes.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Ninguém morando aqui no momento.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/50 text-sm" data-testid="moradores-alojamento">
                {a.alocacoes.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                    <div className="min-w-0">
                      <span className="font-medium">{m.funcionarioNome}</span>
                      <p className="text-xs text-muted-foreground">
                        <span className="tabular">{m.funcionarioMatricula}</span>
                        {m.quarto && <> · Quarto {m.quarto.numero}</>}
                        {m.obraCodigo && <> · Obra {m.obraCodigo}</>}
                        <> · desde {dataBR(m.dataEntrada)}</>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SeloTransporte tipo={m.transporteTipo} />
                      {m.rotaOnibus && <span className="text-xs text-muted-foreground">{m.rotaOnibus.nome}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {a.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI do banco
              <img src={a.foto} alt={`Foto do ${a.nome}`} className="h-40 w-full object-cover" />
            ) : (
              <span className="grid h-40 w-full place-items-center bg-muted"><House className="size-8 text-muted-foreground" /></span>
            )}
            <div className="space-y-2 p-4 text-sm">
              {a.responsavelNome && <p><span className="text-muted-foreground">Responsável:</span> {a.responsavelNome}</p>}
              {zap ? (
                <a href={zap} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Phone className="size-4" /> Falar no WhatsApp
                </a>
              ) : a.telefoneResponsavel ? (
                <p className="text-muted-foreground">{a.telefoneResponsavel}</p>
              ) : null}
              {a.observacoes && <p className="text-muted-foreground">{a.observacoes}</p>}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <h2 className="border-b border-border px-4 py-2 text-sm font-medium">Localização</h2>
            {mapa ? (
              // eslint-disable-next-line @next/next/no-img-element -- mapa estático do Google, URL externa assinada
              <img src={mapa} alt={`Mapa de ${a.nome}`} className="w-full" />
            ) : (
              <p className="p-4 text-xs text-muted-foreground">
                {a.lat != null
                  ? 'A chave pública do Google Maps não está configurada, então o mapa não aparece.'
                  : 'Sem coordenada. Preencha o endereço e ligue a chave do Google Maps para ver o ponto no mapa.'}
              </p>
            )}
          </section>

          {a.distancias.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-medium">Distância até as obras</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {a.distancias.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2">
                    <span>{d.obra.codigo}</span>
                    <span className="tabular text-muted-foreground">{d.distanciaKm} km · {d.duracaoMin} min</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
