'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { brl } from '@/lib/dominio/formato'
import type { FatiaGrafico } from '@/queries/dashboard'

type TickProps = {
  x?: number
  y?: number
  payload?: { value?: string }
  quantidades?: Record<string, number>
}

/**
 * Duas linhas por obra: o código e a contagem de itens.
 *
 * A contagem não é enfeite. uma das obras tem 32 itens ativos e valor
 * R$ 0 (as linhas dela não trazem valor unitário na planilha de origem), então a
 * barra some. Sem a contagem ao lado do nome, essa linha vazia parece defeito do
 * gráfico em vez de lacuna do cadastro.
 */
function TickObra({ x = 0, y = 0, payload, quantidades = {} }: TickProps) {
  const nome = payload?.value ?? ''
  const codigo = nome.split(' · ').at(-1) ?? nome
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-8} y={0} dy={-1} textAnchor="end" fontSize={11} fill="var(--color-foreground)">
        {codigo}
      </text>
      <text x={-8} y={0} dy={11} textAnchor="end" fontSize={9} fill="var(--color-muted-foreground)">
        {quantidades[nome] ?? 0} itens
      </text>
    </g>
  )
}

export function GraficoObra({ dados }: { dados: FatiaGrafico[] }) {
  if (!dados.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem locações ativas.</p>
  }

  const quantidades = Object.fromEntries(dados.map((d) => [d.nome, d.quantidade]))
  const semValor = dados.filter((d) => d.valor === 0)

  return (
    <>
      <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 42)}>
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                 tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="nome" width={88} interval={0}
                 tick={<TickObra quantidades={quantidades} />} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(valor, _nome, item) => [
              `${brl(Number(valor))} · ${item?.payload?.quantidade ?? 0} itens`,
              'Em locação',
            ]}
            contentStyle={{
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              borderRadius: '0.5rem', fontSize: '0.8125rem',
            }}
          />
          <Bar dataKey="valor" fill="var(--primary)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {semValor.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sem barra em {semValor.map((d) => d.nome.split(' · ').at(-1)).join(', ')}: os itens estão
          cadastrados, mas sem valor unitário na planilha de origem.
        </p>
      )}
    </>
  )
}
