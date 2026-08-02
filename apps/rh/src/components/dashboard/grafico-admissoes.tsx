'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = { dados: Array<{ mes: string; total: number }> }

export function GraficoAdmissoes({ dados }: Props) {
  const vazio = dados.every((d) => d.total === 0)

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-medium">Admissões por mês</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses</p>

      {vazio ? (
        <p className="grid h-56 place-items-center text-sm text-muted-foreground">
          Nenhuma admissão no período.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="mes" tickLine={false} axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              {/* allowDecimals={false}: contagem de pessoas não tem meio funcionário. */}
              <YAxis
                allowDecimals={false} tickLine={false} axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--accent)' }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  color: 'var(--card-foreground)',
                }}
                // O tipo do recharts admite string, array e undefined; normalizar aqui
                // evita "NaN admissões" quando o valor não vier como número.
                formatter={(v) => {
                  const n = Number(v)
                  return [Number.isFinite(n) ? `${n} admissã${n === 1 ? 'o' : 'ões'}` : '—', '']
                }}
              />
              <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
