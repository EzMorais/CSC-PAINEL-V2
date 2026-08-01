'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { brl } from '@/lib/dominio/formato'
import type { FatiaGrafico } from '@/queries/dashboard'

const CORES = [
  'oklch(0.55 0.19 255)', 'oklch(0.58 0.20 300)', 'oklch(0.60 0.14 195)',
  'oklch(0.62 0.16 150)', 'oklch(0.70 0.16 75)',  'oklch(0.58 0.20 27)',
]

/** Cinza reservado: não é um fornecedor, é ausência de fornecedor. */
const CINZA = 'oklch(0.50 0.05 260)'

/** Precisa bater com o rótulo que `obterPorFornecedor` usa para locação sem fornecedor. */
const SEM_FORNECEDOR = 'Sem fornecedor'

export function GraficoFornecedor({ dados }: { dados: FatiaGrafico[] }) {
  // "Sem fornecedor" sai do ranking por valor antes do corte. São 35 itens ativos
  // de baixo valor: pela ordenação normal ele cairia dentro de "Outros" e a lacuna
  // de cadastro — que é o dado acionável aqui — sumiria da tela.
  const semFornecedor = dados.find((d) => d.nome === SEM_FORNECEDOR)
  const comFornecedor = dados.filter((d) => d.nome !== SEM_FORNECEDOR)

  const top = comFornecedor.slice(0, 5)
  const resto = comFornecedor.slice(5)
  const fatias = [...top]

  // Agrupar a cauda é o que impede a legenda de virar uma lista de 22 fornecedores
  // ilegível no celular.
  if (resto.length) {
    fatias.push({
      nome: `Outros (${resto.length})`,
      valor: resto.reduce((s, d) => s + d.valor, 0),
      quantidade: resto.reduce((s, d) => s + d.quantidade, 0),
    })
  }
  if (semFornecedor) fatias.push(semFornecedor)

  if (!fatias.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem locações ativas.</p>
  }

  const cor = (f: FatiaGrafico, i: number) => (f.nome === SEM_FORNECEDOR ? CINZA : CORES[i % CORES.length])

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
            {fatias.map((f, i) => <Cell key={f.nome} fill={cor(f, i)} />)}
          </Pie>
          <Tooltip
            // A quantidade vai junto do valor de propósito: LOK tem 118 itens e vale
            // menos que MIL MÁQUINAS com 10. Só a fatia contaria essa história errada.
            formatter={(valor, nome, item) => [
              `${brl(Number(valor))} · ${item?.payload?.quantidade ?? 0} itens`,
              String(nome),
            ]}
            contentStyle={{
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
              borderRadius: '0.5rem', fontSize: '0.8125rem',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda em HTML, não a do recharts: a dela é posicionada em absoluto dentro
          do gráfico e, com sete rótulos longos a 390px, quebra em quatro linhas que
          transbordam o contêiner e caem por cima do texto seguinte. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {fatias.map((f, i) => (
          <li key={f.nome} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: cor(f, i) }} />
            <span className="text-foreground">{f.nome}</span>
            <span className="tabular">{f.quantidade} itens</span>
          </li>
        ))}
      </ul>
    </>
  )
}
