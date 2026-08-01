# Painel de Locação SC — Plano de Implementação, Parte 2

> Continuação de `2026-07-31-painel-locacao-mvp.md`. Comece esta parte só depois que a Task 10 estiver commitada e a importação tiver rodado com os números conferidos (242 / 61 / 16 / 110).

**Esta parte cobre:** Fase 3 — interface (layout, tema, dashboard, listagem, ações).

## Duas coisas para saber antes de começar

**1. As Tasks 14, 15 e 16 formam uma unidade que só compila junta.** A página de listagem
importa `PainelLocacoes`, que importa `DialogAcao` e `AcoesLote`. Cada arquivo é criado na
sua própria task, então `npm run build` vai reclamar de módulo inexistente até a Task 16
terminar. Isso é esperado — não tente "consertar" criando stubs. Rode `npm run dev` para
ver o progresso e deixe a verificação de build para o passo 7 da Task 17.

**2. Cores de status — a sintaxe já foi decidida, não improvise.** As cinco cores são
declaradas em `@theme inline` no `globals.css` (Task 11), o que faz o Tailwind v4 gerar
utilitários nomeados. Use sempre a forma nomeada:

```
text-status-vencida   bg-status-atencao/10   border-l-status-ativa   ← use esta
```

A forma com colchete cru (`text-[--color-status-vencida]`) **não funciona**: ela não aplica a
cor, o elemento herda o `foreground` e a etiqueta sai preta sem erro nenhum no console. Isso
foi verificado empiricamente na revisão da Task 11, injetando as quatro variantes numa página
e lendo a cor computada no navegador. `text-(--color-status-vencida)` também funciona, mas
padronize na nomeada.

As cinco cores disponíveis: `status-ativa`, `status-atencao`, `status-vencida`,
`status-devolvida`, `status-perdido`.

---

# Fase 3 — Interface

## Task 11: Layout, tema e navegação

**Arquivos:**
- Modificar: `src/app/layout.tsx`, `src/app/globals.css`
- Criar: `src/components/layout/sidebar.tsx`, `src/components/layout/theme-toggle.tsx`, `src/components/providers.tsx`

Light por padrão — o painel é consultado no celular em canteiro, sob sol. O toggle escuro fica disponível para quem prefere.

- [ ] **Passo 1: Definir as cores de status no CSS**

Acrescente ao fim de `src/app/globals.css`:

```css
@theme inline {
  --color-status-ativa: oklch(0.62 0.16 150);
  --color-status-atencao: oklch(0.70 0.16 75);
  --color-status-vencida: oklch(0.58 0.20 27);
  --color-status-devolvida: oklch(0.55 0.02 260);
  --color-status-perdido: oklch(0.50 0.22 320);
}

/* Números em tabela alinham por dígito, não por largura de glifo. */
.tabular {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Passo 2: Instalar e configurar o provider de tema**

Crie `src/components/providers.tsx`:

```tsx
'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  )
}
```

`enableSystem={false}` é deliberado: a preferência do sistema operacional no celular costuma ser escura, e o padrão claro aqui é uma decisão de legibilidade em campo, não de gosto.

- [ ] **Passo 3: Escrever o toggle**

Crie `src/components/layout/theme-toggle.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  if (!montado) return <div className="size-9" aria-hidden />

  const escuro = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground
                 hover:bg-accent hover:text-foreground"
    >
      {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
```

O guarda de `montado` evita o descasamento de hidratação — o servidor não sabe qual tema o navegador guardou.

- [ ] **Passo 4: Escrever a navegação**

Crie `src/components/layout/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Package, Building2, Truck, Upload, Menu, X } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

const ITENS = [
  { href: '/',              rotulo: 'Dashboard',    Icone: LayoutDashboard },
  { href: '/locacoes',      rotulo: 'Locações',     Icone: Package },
  { href: '/obras',         rotulo: 'Obras',        Icone: Building2 },
  { href: '/fornecedores',  rotulo: 'Fornecedores', Icone: Truck },
  { href: '/importar',      rotulo: 'Importar',     Icone: Upload },
]

export function Sidebar() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  const links = ITENS.map(({ href, rotulo, Icone }) => {
    const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href} href={href} onClick={() => setAberto(false)}
        aria-current={ativo ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          ativo ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <Icone className="size-4 shrink-0" />
        {rotulo}
      </Link>
    )
  })

  return (
    <>
      {/* Barra superior — só no mobile */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <button
          type="button" onClick={() => setAberto(true)}
          aria-label="Abrir menu" aria-expanded={aberto}
          className="grid size-9 place-items-center rounded-md border border-border"
        >
          <Menu className="size-4" />
        </button>
        <span className="font-semibold">Locação SC</span>
        <ThemeToggle />
      </header>

      {/* Overlay do menu no mobile */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAberto(false)} aria-hidden />
      )}

      <nav
        data-testid="navegacao"
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card p-4
                    transition-transform lg:static lg:translate-x-0
                    ${aberto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold leading-tight">Siqueira Campos</p>
            <p className="text-xs text-muted-foreground">Painel de Locação</p>
          </div>
          <button
            type="button" onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="grid size-8 place-items-center rounded-md border border-border lg:hidden"
          >
            <X className="size-4" />
          </button>
          <div className="hidden lg:block"><ThemeToggle /></div>
        </div>

        <div className="space-y-1">{links}</div>
      </nav>
    </>
  )
}
```

- [ ] **Passo 5: Montar o layout raiz**

Substitua o conteúdo de `src/app/layout.tsx` por:

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { Sidebar } from '@/components/layout/sidebar'

export const metadata: Metadata = {
  title: 'Painel de Locação — Siqueira Campos',
  description: 'Controle de equipamentos locados por obra',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          <div className="lg:flex">
            <Sidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

`min-w-0` no `main` é o que impede uma tabela larga de empurrar o layout e criar rolagem horizontal na página inteira.

- [ ] **Passo 6: Verificar**

```bash
npm run dev
```

Abra `http://localhost:3000/importar`. Esperado: navegação à esquerda no desktop; ao estreitar a janela abaixo de 1024px, ela vira barra superior com botão de menu que abre o painel deslizante. O toggle de tema alterna claro/escuro e a escolha persiste ao recarregar.

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat: layout responsivo com navegação e tema claro/escuro"
```

---

## Task 12: Consultas do dashboard

**Arquivos:**
- Criar: `src/queries/dashboard.ts`

Status não é coluna, então as contagens por status viram filtros de data. Fazer isso no banco em vez de carregar 303 registros na memória é o que mantém o painel instantâneo quando a base crescer.

- [ ] **Passo 1: Escrever as consultas**

Crie `src/queries/dashboard.ts`:

```ts
import { addDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { ESTADO } from '@/lib/dominio/constantes'
import { valorTotal } from '@/lib/dominio/periodo'

export type IndicadoresDashboard = {
  valorEmLocacao: number
  ativos: number
  vencemEm7Dias: number
  vencidos: number
  perdidos: number
  aConfirmar: number
}

const naoDevolvida = { devolvidaEm: null } as const

export async function obterIndicadores(hoje = new Date()): Promise<IndicadoresDashboard> {
  const inicioHoje = startOfDay(hoje)
  const limite7 = addDays(inicioHoje, 7)

  const [locacoes, ativos, vencemEm7Dias, vencidos, perdidos, aConfirmar] = await Promise.all([
    prisma.locacao.findMany({
      where: naoDevolvida,
      select: { valorItem: true, dataInicio: true, dataFim: true },
    }),
    prisma.locacao.count({ where: naoDevolvida }),
    prisma.locacao.count({ where: { ...naoDevolvida, dataFim: { gte: inicioHoje, lte: limite7 } } }),
    prisma.locacao.count({ where: { ...naoDevolvida, dataFim: { lt: inicioHoje } } }),
    prisma.locacao.count({ where: { ...naoDevolvida, estado: ESTADO.PERDIDO } }),
    prisma.locacao.count({ where: { ...naoDevolvida, obraAConfirmar: true } }),
  ])

  const valorEmLocacao = locacoes.reduce(
    (soma, l) => soma + valorTotal(l.valorItem, l.dataInicio, l.dataFim),
    0
  )

  return { valorEmLocacao, ativos, vencemEm7Dias, vencidos, perdidos, aConfirmar }
}

export type FatiaGrafico = { nome: string; valor: number; quantidade: number }

export async function obterPorFornecedor(): Promise<FatiaGrafico[]> {
  const locacoes = await prisma.locacao.findMany({
    where: naoDevolvida,
    select: {
      valorItem: true, dataInicio: true, dataFim: true,
      fornecedor: { select: { nome: true } },
    },
  })

  const agregado = new Map<string, { valor: number; quantidade: number }>()
  for (const l of locacoes) {
    const nome = l.fornecedor?.nome ?? 'Sem fornecedor'
    const atual = agregado.get(nome) ?? { valor: 0, quantidade: 0 }
    atual.valor += valorTotal(l.valorItem, l.dataInicio, l.dataFim)
    atual.quantidade += 1
    agregado.set(nome, atual)
  }

  return [...agregado]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor)
}

export async function obterPorObra(): Promise<FatiaGrafico[]> {
  const locacoes = await prisma.locacao.findMany({
    where: naoDevolvida,
    select: {
      valorItem: true, dataInicio: true, dataFim: true,
      obra: { select: { codigo: true, cliente: true } },
    },
  })

  const agregado = new Map<string, { valor: number; quantidade: number }>()
  for (const l of locacoes) {
    const nome = `${l.obra.cliente} · ${l.obra.codigo}`
    const atual = agregado.get(nome) ?? { valor: 0, quantidade: 0 }
    atual.valor += valorTotal(l.valorItem, l.dataInicio, l.dataFim)
    atual.quantidade += 1
    agregado.set(nome, atual)
  }

  return [...agregado]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor)
}

export async function obterVencimentosProximos(hoje = new Date()) {
  const inicioHoje = startOfDay(hoje)
  return prisma.locacao.findMany({
    where: { ...naoDevolvida, dataFim: { lte: addDays(inicioHoje, 7) } },
    orderBy: { dataFim: 'asc' },
    take: 25,
    select: {
      id: true, descricao: true, trCodigo: true, dataFim: true, valorItem: true,
      obra: { select: { codigo: true, cliente: true } },
      fornecedor: { select: { nome: true } },
    },
  })
}
```

`obterVencimentosProximos` usa `lte` sem piso inferior de propósito: vencidos aparecem junto dos que estão por vencer, porque quem abre o painel de manhã precisa ver os dois na mesma lista.

- [ ] **Passo 2: Verificar contra o banco importado**

```bash
npm run db:reset && npx tsx -e "
import { confirmarImportacao } from './src/actions/importar'
import { obterIndicadores, obterPorFornecedor, obterPorObra } from './src/queries/dashboard'
import { prisma } from './src/lib/prisma'
await confirmarImportacao('dados/Maquinas_Alugadas_Controle_REVISADA.xlsx')
console.log('Indicadores:', await obterIndicadores())
console.log('\nTop 5 fornecedores:')
for (const f of (await obterPorFornecedor()).slice(0, 5)) console.log('  ', f)
console.log('\nPor obra:')
for (const o of await obterPorObra()) console.log('  ', o)
await prisma.\$disconnect()
"
```

Esperado: `ativos: 242`, `perdidos: 16`, `aConfirmar: 110`, e `valorEmLocacao` bem acima de R$ 123.681 — aquele número era a soma do valor de item; este multiplica pelos períodos decorridos, que é o custo real. Os fornecedores devem aparecer com nome canônico (`KAISEN LOCAÇÕES`, não `KAISEN`), provando que a normalização por alias funcionou.

- [ ] **Passo 3: Commit**

```bash
git add -A
git commit -m "feat: consultas de indicadores e agregações do dashboard"
```

---

## Task 13: Dashboard

**Arquivos:**
- Criar: `src/components/dashboard/kpi-card.tsx`, `grafico-fornecedor.tsx`, `grafico-obra.tsx`, `tabela-vencimentos.tsx`
- Modificar: `src/app/page.tsx`

- [ ] **Passo 1: Escrever o cartão de indicador**

Crie `src/components/dashboard/kpi-card.tsx`:

```tsx
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'ativa' | 'atencao' | 'vencida' | 'perdido'
  href?: string
  icone?: ReactNode
}

const TONS = {
  neutro:  'border-border',
  ativa:   'border-l-4 border-l-status-ativa',
  atencao: 'border-l-4 border-l-status-atencao',
  vencida: 'border-l-4 border-l-status-vencida',
  perdido: 'border-l-4 border-l-status-perdido',
} as const

export function KpiCard({ rotulo, valor, detalhe, tom = 'neutro', href, icone }: Props) {
  const conteudo = (
    <div className={`rounded-lg border bg-card p-4 ${TONS[tom]} ${href ? 'transition-colors hover:bg-accent' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        {icone}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular sm:text-3xl">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  )
  return href ? <Link href={href}>{conteudo}</Link> : conteudo
}
```

- [ ] **Passo 2: Escrever o gráfico de fornecedores**

Crie `src/components/dashboard/grafico-fornecedor.tsx`:

```tsx
'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { brl } from '@/lib/dominio/formato'
import type { FatiaGrafico } from '@/queries/dashboard'

const CORES = [
  'oklch(0.55 0.19 255)', 'oklch(0.58 0.20 300)', 'oklch(0.60 0.14 195)',
  'oklch(0.62 0.16 150)', 'oklch(0.70 0.16 75)',  'oklch(0.58 0.20 27)',
  'oklch(0.50 0.05 260)',
]

export function GraficoFornecedor({ dados }: { dados: FatiaGrafico[] }) {
  const top = dados.slice(0, 6)
  const resto = dados.slice(6)
  const fatias = resto.length
    ? [...top, { nome: `Outros (${resto.length})`, valor: resto.reduce((s, d) => s + d.valor, 0), quantidade: resto.reduce((s, d) => s + d.quantidade, 0) }]
    : top

  if (!fatias.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem locações ativas.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {fatias.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
        </Pie>
        <Tooltip
          formatter={(valor: number, nome: string) => [brl(valor), nome]}
          contentStyle={{
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
            borderRadius: '0.5rem', fontSize: '0.8125rem',
          }}
        />
        <Legend verticalAlign="bottom" height={56} iconType="circle" iconSize={8}
                formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

Agrupar a cauda em "Outros" é o que impede a legenda de virar uma lista de 22 fornecedores ilegível no celular.

- [ ] **Passo 3: Escrever o gráfico de obras**

Crie `src/components/dashboard/grafico-obra.tsx`:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { brl } from '@/lib/dominio/formato'
import type { FatiaGrafico } from '@/queries/dashboard'

export function GraficoObra({ dados }: { dados: FatiaGrafico[] }) {
  if (!dados.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem locações ativas.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 34)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" />
        <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
               tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="nome" width={150}
               tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(valor: number) => [brl(valor), 'Valor']}
          contentStyle={{
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
            borderRadius: '0.5rem', fontSize: '0.8125rem',
          }}
        />
        <Bar dataKey="valor" fill="oklch(0.55 0.19 255)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Passo 4: Escrever a tabela de vencimentos**

Crie `src/components/dashboard/tabela-vencimentos.tsx`:

```tsx
import Link from 'next/link'
import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { brl, dataBR } from '@/lib/dominio/formato'

type Item = {
  id: string
  descricao: string
  trCodigo: string | null
  dataFim: Date | null
  valorItem: number | null
  obra: { codigo: string; cliente: string }
  fornecedor: { nome: string } | null
}

const CLASSE_STATUS: Record<string, string> = {
  VENCIDA: 'text-status-vencida',
  ATENCAO: 'text-status-atencao',
  ATIVA: 'text-status-ativa',
  SEM_PRAZO: 'text-muted-foreground',
  DEVOLVIDA: 'text-muted-foreground',
}

export function TabelaVencimentos({ itens }: { itens: Item[] }) {
  if (!itens.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Nada vencendo nos próximos 7 dias.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Equipamento</th>
            <th className="py-2 pr-4 font-medium">Obra</th>
            <th className="py-2 pr-4 font-medium">Fim</th>
            <th className="py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const status = calcularStatus({ dataFim: i.dataFim, devolvidaEm: null })
            return (
              <tr key={i.id} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/locacoes?item=${i.id}`} className="font-medium hover:underline">
                    {i.descricao}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {i.trCodigo ? `Tr ${i.trCodigo}` : 'sem Tr'}
                    {i.fornecedor ? ` · ${i.fornecedor.nome}` : ''}
                    {i.valorItem ? ` · ${brl(i.valorItem)}` : ''}
                  </p>
                </td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground">{i.obra.codigo}</td>
                <td className="py-2.5 pr-4 tabular text-xs">{dataBR(i.dataFim)}</td>
                <td className={`py-2.5 text-xs font-medium ${CLASSE_STATUS[status]}`}>
                  {rotuloVencimento(i.dataFim)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Passo 5: Montar a página**

Substitua o conteúdo de `src/app/page.tsx` por:

```tsx
import { AlertTriangle, CircleAlert, Package, PackageX, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { GraficoFornecedor } from '@/components/dashboard/grafico-fornecedor'
import { GraficoObra } from '@/components/dashboard/grafico-obra'
import { TabelaVencimentos } from '@/components/dashboard/tabela-vencimentos'
import { brl } from '@/lib/dominio/formato'
import { obterIndicadores, obterPorFornecedor, obterPorObra, obterVencimentosProximos } from '@/queries/dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [kpi, porFornecedor, porObra, vencimentos] = await Promise.all([
    obterIndicadores(),
    obterPorFornecedor(),
    obterPorObra(),
    obterVencimentosProximos(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Equipamentos locados por obra</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/xlsx" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Exportar Excel
          </a>
          <a href="/api/export/pdf" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Exportar PDF
          </a>
        </div>
      </header>

      <section aria-label="Indicadores" data-testid="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard rotulo="Em locação" valor={brl(kpi.valorEmLocacao)} detalhe={`${kpi.ativos} itens ativos`}
                 icone={<Wallet className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Itens ativos" valor={String(kpi.ativos)} detalhe="em aberto" tom="ativa"
                 href="/locacoes" icone={<Package className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Vencem em 7 dias" valor={String(kpi.vencemEm7Dias)} detalhe="exigem atenção" tom="atencao"
                 href="/locacoes?status=ATENCAO" icone={<AlertTriangle className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Vencidos" valor={String(kpi.vencidos)} detalhe="prazo encerrado" tom="vencida"
                 href="/locacoes?status=VENCIDA" icone={<CircleAlert className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Itens perdidos" valor={String(kpi.perdidos)} detalhe="a acertar com o locador" tom="perdido"
                 href="/locacoes?estado=PERDIDO" icone={<PackageX className="size-4 text-muted-foreground" />} />
      </section>

      {kpi.aConfirmar > 0 && (
        <div role="status" className="rounded-lg border border-amber-600/50 bg-amber-600/10 p-4 text-sm">
          <strong className="font-medium">{kpi.aConfirmar} itens com obra a confirmar.</strong>{' '}
          Vieram de abas compartilhadas por mais de uma obra na planilha.{' '}
          <a href="/locacoes?aConfirmar=1" className="font-medium underline">Reclassificar</a>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Valor por fornecedor</h2>
          <GraficoFornecedor dados={porFornecedor} />
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Valor por obra</h2>
          <GraficoObra dados={porObra} />
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-medium">Vencimentos até 7 dias</h2>
        <TabelaVencimentos itens={vencimentos} />
      </section>
    </div>
  )
}
```

`export const dynamic = 'force-dynamic'` é necessário: o dashboard depende da data de hoje, e o Next cachearia a página estaticamente na build, congelando os vencimentos.

- [ ] **Passo 6: Verificar**

```bash
npm run dev
```

Abra `http://localhost:3000`. Esperado: cinco cartões com 242 ativos e 16 perdidos, o aviso âmbar dos 110 a confirmar, os dois gráficos preenchidos e a tabela de vencimentos ordenada com os vencidos no topo. Estreite para 390px: os cartões empilham, os gráficos continuam legíveis e nenhuma barra de rolagem horizontal aparece na página.

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat: dashboard com indicadores, gráficos e vencimentos"
```

---

## Task 14: Listagem com filtros

**Arquivos:**
- Criar: `src/queries/locacoes.ts`, `src/components/locacoes/filtros.tsx`, `src/components/locacoes/tabela-locacoes.tsx`
- Criar: `src/app/locacoes/page.tsx`

Os filtros vivem na URL, não em estado de componente. Assim os links do dashboard (`/locacoes?status=VENCIDA`) funcionam, a busca fica compartilhável e o botão voltar do navegador se comporta.

- [ ] **Passo 1: Escrever a consulta**

Crie `src/queries/locacoes.ts`:

```ts
import type { Prisma } from '@prisma/client'
import { addDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { DIAS_ATENCAO, STATUS } from '@/lib/dominio/constantes'

export type FiltrosLocacao = {
  busca?: string
  obraId?: string
  fornecedorId?: string
  status?: string
  estado?: string
  aConfirmar?: boolean
}

function clausulaStatus(status: string | undefined, hoje: Date): Prisma.LocacaoWhereInput {
  const inicioHoje = startOfDay(hoje)
  switch (status) {
    case STATUS.DEVOLVIDA:
      return { devolvidaEm: { not: null } }
    case STATUS.VENCIDA:
      return { devolvidaEm: null, dataFim: { lt: inicioHoje } }
    case STATUS.ATENCAO:
      return { devolvidaEm: null, dataFim: { gte: inicioHoje, lte: addDays(inicioHoje, DIAS_ATENCAO) } }
    case STATUS.ATIVA:
      return { devolvidaEm: null, dataFim: { gt: addDays(inicioHoje, DIAS_ATENCAO) } }
    case STATUS.SEM_PRAZO:
      return { devolvidaEm: null, dataFim: null }
    default:
      return { devolvidaEm: null }
  }
}

export async function listarLocacoes(filtros: FiltrosLocacao, hoje = new Date()) {
  const where: Prisma.LocacaoWhereInput = { ...clausulaStatus(filtros.status, hoje) }

  if (filtros.obraId) where.obraId = filtros.obraId
  if (filtros.fornecedorId) where.fornecedorId = filtros.fornecedorId
  if (filtros.estado) where.estado = filtros.estado
  if (filtros.aConfirmar) where.obraAConfirmar = true

  if (filtros.busca?.trim()) {
    const b = filtros.busca.trim()
    where.OR = [
      { descricao: { contains: b } },
      { trCodigo: { contains: b } },
      { observacoes: { contains: b } },
      { numeroOrigem: { contains: b } },
    ]
  }

  return prisma.locacao.findMany({
    where,
    orderBy: [{ dataFim: 'asc' }, { descricao: 'asc' }],
    include: {
      obra: { select: { id: true, codigo: true, cliente: true } },
      fornecedor: { select: { id: true, nome: true } },
    },
  })
}

export type LocacaoListada = Awaited<ReturnType<typeof listarLocacoes>>[number]

export async function obterLocacao(id: string) {
  return prisma.locacao.findUnique({
    where: { id },
    include: {
      obra: { select: { id: true, codigo: true, cliente: true, descricao: true } },
      fornecedor: { select: { id: true, nome: true, telefone: true } },
      movimentacoes: { orderBy: { criadoEm: 'desc' } },
    },
  })
}

export async function opcoesDeFiltro() {
  const [obras, fornecedores] = await Promise.all([
    prisma.obra.findMany({ where: { ativa: true }, orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, cliente: true } }),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' },
      select: { id: true, nome: true } }),
  ])
  return { obras, fornecedores }
}
```

O SQLite não suporta `mode: 'insensitive'` no Prisma — a busca aqui é sensível a maiúsculas. Como as descrições foram gravadas em caixa alta pela planilha, e o formulário de registro também salva em caixa alta (Task 16), na prática isso não atrapalha. Se atrapalhar, a saída é guardar uma coluna `descricaoBusca` já normalizada.

- [ ] **Passo 2: Escrever os filtros**

Crie `src/components/locacoes/filtros.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { ROTULO_STATUS, STATUS } from '@/lib/dominio/constantes'

type Props = {
  obras: { id: string; codigo: string; cliente: string }[]
  fornecedores: { id: string; nome: string }[]
}

export function Filtros({ obras, fornecedores }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [abertoNoMobile, setAberto] = useState(false)
  const [, iniciar] = useTransition()

  function aplicar(chave: string, valor: string) {
    const novos = new URLSearchParams(params.toString())
    valor ? novos.set(chave, valor) : novos.delete(chave)
    iniciar(() => router.push(`/locacoes?${novos.toString()}`))
  }

  const ativos = ['busca', 'obraId', 'fornecedorId', 'status', 'estado', 'aConfirmar']
    .filter((c) => params.get(c))

  const classeCampo =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" placeholder="Buscar equipamento, Tr, observação..."
            defaultValue={params.get('busca') ?? ''}
            onChange={(e) => aplicar('busca', e.target.value)}
            aria-label="Buscar locações"
            className={`${classeCampo} pl-9`}
          />
        </div>
        <button
          type="button" onClick={() => setAberto((v) => !v)}
          aria-expanded={abertoNoMobile} aria-label="Filtros"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          {ativos.length > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
              {ativos.length}
            </span>
          )}
        </button>
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${abertoNoMobile ? '' : 'hidden lg:grid'}`}>
        <select aria-label="Obra" className={classeCampo}
                value={params.get('obraId') ?? ''} onChange={(e) => aplicar('obraId', e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
        </select>

        <select aria-label="Fornecedor" className={classeCampo}
                value={params.get('fornecedorId') ?? ''} onChange={(e) => aplicar('fornecedorId', e.target.value)}>
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>

        <select aria-label="Situação" className={classeCampo}
                value={params.get('status') ?? ''} onChange={(e) => aplicar('status', e.target.value)}>
          <option value="">Em aberto (todas)</option>
          {Object.values(STATUS).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>

        <select aria-label="Estado do item" className={classeCampo}
                value={params.get('estado') ?? ''} onChange={(e) => aplicar('estado', e.target.value)}>
          <option value="">Qualquer estado</option>
          <option value="OK">Em ordem</option>
          <option value="PERDIDO">Perdido</option>
          <option value="DANIFICADO">Danificado</option>
        </select>
      </div>

      {ativos.length > 0 && (
        <button type="button" onClick={() => iniciar(() => router.push('/locacoes'))}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3" /> Limpar {ativos.length} filtro{ativos.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Escrever a tabela**

Crie `src/components/locacoes/tabela-locacoes.tsx`:

```tsx
'use client'

import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { brl, dataBR } from '@/lib/dominio/formato'
import { valorTotal } from '@/lib/dominio/periodo'
import type { LocacaoListada } from '@/queries/locacoes'

const CLASSE_STATUS: Record<string, string> = {
  VENCIDA: 'bg-status-vencida/10 text-status-vencida',
  ATENCAO: 'bg-status-atencao/10 text-status-atencao',
  ATIVA: 'bg-status-ativa/10 text-status-ativa',
  DEVOLVIDA: 'bg-muted text-muted-foreground',
  SEM_PRAZO: 'bg-muted text-muted-foreground',
}

type Props = {
  itens: LocacaoListada[]
  selecionados: Set<string>
  aoSelecionar: (id: string, marcado: boolean) => void
  aoAbrir: (id: string) => void
}

// Declarado FORA do componente de propósito. Um componente definido dentro do corpo de
// outro é recriado a cada render: o React o trata como um tipo novo, desmonta a subárvore
// e remonta do zero. Em elementos com estado próprio ou campos não controlados, isso apaga
// o que o usuário digitou no meio da digitação.
function Etiqueta({ item }: { item: LocacaoListada }) {
  const status = calcularStatus({ dataFim: item.dataFim, devolvidaEm: item.devolvidaEm })
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${CLASSE_STATUS[status]}`}>
      {item.devolvidaEm ? `devolvida ${dataBR(item.devolvidaEm)}` : rotuloVencimento(item.dataFim)}
    </span>
  )
}

export function TabelaLocacoes({ itens, selecionados, aoSelecionar, aoAbrir }: Props) {
  if (!itens.length) {
    return (
      <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Nenhuma locação encontrada com esses filtros.
      </p>
    )
  }

  return (
    <>
      {/* Cards — mobile */}
      <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
        {itens.map((i) => (
          <li key={i.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox" checked={selecionados.has(i.id)}
                onChange={(e) => aoSelecionar(i.id, e.target.checked)}
                aria-label={`Selecionar ${i.descricao}`} className="mt-1 size-4"
              />
              <button type="button" onClick={() => aoAbrir(i.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{i.descricao}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {i.obra.codigo} · {i.fornecedor?.nome ?? 'sem fornecedor'}
                  {i.trCodigo ? ` · Tr ${i.trCodigo}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Etiqueta item={i} />
                  {i.estado === 'PERDIDO' && (
                    <span className="rounded bg-status-perdido/10 px-1.5 py-0.5 text-xs font-medium text-status-perdido">
                      perdido
                    </span>
                  )}
                  {i.obraAConfirmar && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      obra a confirmar
                    </span>
                  )}
                  <span className="ml-auto text-xs tabular text-muted-foreground">
                    {brl(valorTotal(i.valorItem, i.dataInicio, i.dataFim))}
                  </span>
                </div>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Tabela — desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table data-testid="tabela-locacoes" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2" />
              <th className="py-2 pr-4 font-medium">Equipamento</th>
              <th className="py-2 pr-4 font-medium">Obra</th>
              <th className="py-2 pr-4 font-medium">Fornecedor</th>
              <th className="py-2 pr-4 font-medium">Início</th>
              <th className="py-2 pr-4 font-medium">Fim</th>
              <th className="py-2 pr-4 font-medium">Situação</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b border-border/50 hover:bg-accent/50">
                <td className="py-2">
                  <input
                    type="checkbox" checked={selecionados.has(i.id)}
                    onChange={(e) => aoSelecionar(i.id, e.target.checked)}
                    aria-label={`Selecionar ${i.descricao}`} className="size-4"
                  />
                </td>
                <td className="py-2 pr-4">
                  <button type="button" onClick={() => aoAbrir(i.id)} className="text-left font-medium hover:underline">
                    {i.descricao}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {i.trCodigo ? `Tr ${i.trCodigo}` : '—'}
                    {i.quantidade > 1 ? ` · ${i.quantidade} un` : ''}
                    {i.estado === 'PERDIDO' ? ' · perdido' : ''}
                    {i.obraAConfirmar ? ' · obra a confirmar' : ''}
                  </p>
                </td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">{i.obra.codigo}</td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">{i.fornecedor?.nome ?? '—'}</td>
                <td className="py-2 pr-4 tabular text-xs">{dataBR(i.dataInicio)}</td>
                <td className="py-2 pr-4 tabular text-xs">{dataBR(i.dataFim)}</td>
                <td className="py-2 pr-4"><Etiqueta item={i} /></td>
                <td className="py-2 text-right tabular text-xs">
                  {brl(valorTotal(i.valorItem, i.dataInicio, i.dataFim))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Passo 4: Montar a página**

Crie `src/app/locacoes/page.tsx`:

```tsx
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Filtros } from '@/components/locacoes/filtros'
import { PainelLocacoes } from '@/components/locacoes/painel-locacoes'
import { listarLocacoes, opcoesDeFiltro } from '@/queries/locacoes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Locações — Painel SC' }

export default async function LocacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const [itens, opcoes] = await Promise.all([
    listarLocacoes({
      busca: sp.busca,
      obraId: sp.obraId,
      fornecedorId: sp.fornecedorId,
      status: sp.status,
      estado: sp.estado,
      aConfirmar: sp.aConfirmar === '1',
    }),
    opcoesDeFiltro(),
  ])

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Locações</h1>
          <p className="text-sm text-muted-foreground" data-testid="contagem">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <Link href="/locacoes/nova"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="size-4" /> Nova locação
        </Link>
      </header>

      <Filtros obras={opcoes.obras} fornecedores={opcoes.fornecedores} />
      <PainelLocacoes itens={itens} obras={opcoes.obras} itemInicial={sp.item} />
    </div>
  )
}
```

`PainelLocacoes` é criado na Task 15 — a página não compila até lá, o que é esperado.

- [ ] **Passo 5: Commit**

```bash
git add -A
git commit -m "feat: listagem de locações com filtros na URL e cards no mobile"
```

---

## Task 15: Painel, drawer de detalhe e histórico

**Arquivos:**
- Criar: `src/components/locacoes/painel-locacoes.tsx`, `src/components/locacoes/drawer-locacao.tsx`
- Criar: `src/actions/locacoes.ts`

O drawer é o que a planilha nunca teve: a aba Histórico lista as movimentações reais, não texto colado na observação.

- [ ] **Passo 1: Escrever as actions de leitura e ação**

Crie `src/actions/locacoes.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { MOVIMENTACAO } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import { obterLocacao } from '@/queries/locacoes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

function revalidar() {
  revalidatePath('/')
  revalidatePath('/locacoes')
}

export async function carregarLocacao(id: string) {
  return obterLocacao(id)
}

const esquemaLocacao = z.object({
  obraId: z.string().min(1, 'Selecione a obra.'),
  descricao: z.string().trim().min(2, 'Informe o equipamento.'),
  trCodigo: z.string().trim().optional(),
  fornecedorId: z.string().optional(),
  quantidade: z.coerce.number().int().min(1).default(1),
  dataInicio: z.coerce.date({ message: 'Data de início inválida.' }),
  dataFim: z.coerce.date({ message: 'Data de fim inválida.' }),
  valorItem: z.coerce.number().nonnegative().optional(),
  observacoes: z.string().trim().optional(),
})

export async function criarLocacao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const parsed = esquemaLocacao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  if (d.dataFim < d.dataInicio) return { ok: false, erro: 'A data de fim é anterior à de início.' }

  try {
    const locacao = await prisma.locacao.create({
      data: {
        obraId: d.obraId,
        descricao: d.descricao.toUpperCase(),
        trCodigo: d.trCodigo || null,
        fornecedorId: d.fornecedorId || null,
        quantidade: d.quantidade,
        dataInicio: d.dataInicio,
        dataFim: d.dataFim,
        valorItem: d.valorItem ?? null,
        observacoes: d.observacoes || null,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.REGISTRO,
            descricaoHumana: `Registrada de ${dataBR(d.dataInicio)} a ${dataBR(d.dataFim)}`,
          },
        },
      },
    })
    revalidar()
    return { ok: true, dados: { id: locacao.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar' }
  }
}

export async function editarLocacao(id: string, entrada: unknown): Promise<Resultado> {
  const parsed = esquemaLocacao.partial().safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  try {
    const antes = await prisma.locacao.findUnique({ where: { id } })
    if (!antes) return { ok: false, erro: 'Locação não encontrada.' }

    const d = parsed.data
    await prisma.locacao.update({
      where: { id },
      data: {
        ...(d.obraId && { obraId: d.obraId }),
        ...(d.descricao && { descricao: d.descricao.toUpperCase() }),
        ...(d.trCodigo !== undefined && { trCodigo: d.trCodigo || null }),
        ...(d.fornecedorId !== undefined && { fornecedorId: d.fornecedorId || null }),
        ...(d.quantidade !== undefined && { quantidade: d.quantidade }),
        ...(d.dataInicio && { dataInicio: d.dataInicio }),
        ...(d.dataFim && { dataFim: d.dataFim }),
        ...(d.valorItem !== undefined && { valorItem: d.valorItem }),
        ...(d.observacoes !== undefined && { observacoes: d.observacoes || null }),
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.EDICAO,
            descricaoHumana: 'Dados editados',
            payloadAntes: JSON.stringify(antes),
            payloadDepois: JSON.stringify(d),
          },
        },
      },
    })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao editar' }
  }
}

export async function renovarLocacao(id: string, diasExtras?: number): Promise<Resultado<{ novaData: Date }>> {
  try {
    const l = await prisma.locacao.findUnique({ where: { id } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação já devolvida — não pode ser renovada.' }
    if (!l.dataInicio || !l.dataFim) return { ok: false, erro: 'Locação sem datas — edite antes de renovar.' }

    const dias = diasExtras ?? differenceInCalendarDays(l.dataFim, l.dataInicio)
    if (dias <= 0) return { ok: false, erro: 'Período de renovação inválido.' }

    const novaData = new Date(l.dataFim)
    novaData.setUTCDate(novaData.getUTCDate() + dias)

    await prisma.locacao.update({
      where: { id },
      data: {
        dataFim: novaData,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.RENOVACAO,
            descricaoHumana: `Renovada por ${dias} dias — novo fim ${dataBR(novaData)}`,
            payloadAntes: JSON.stringify({ dataFim: l.dataFim }),
            payloadDepois: JSON.stringify({ dataFim: novaData }),
          },
        },
      },
    })
    revalidar()
    return { ok: true, dados: { novaData } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao renovar' }
  }
}

export async function devolverLocacao(id: string, dataDevolucao: Date, motivo?: string): Promise<Resultado> {
  try {
    const l = await prisma.locacao.findUnique({ where: { id } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação já devolvida.' }

    await prisma.locacao.update({
      where: { id },
      data: {
        devolvidaEm: dataDevolucao,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.DEVOLUCAO,
            descricaoHumana:
              `Devolvida em ${dataBR(dataDevolucao)}` +
              (l.dataInicio ? ` — permaneceu ${differenceInCalendarDays(dataDevolucao, l.dataInicio)} dias na obra` : '') +
              (motivo ? ` · ${motivo}` : ''),
          },
        },
      },
    })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao devolver' }
  }
}

export async function transferirLocacao(
  id: string, obraDestinoId: string, dataInicio: Date, dataFim: Date, motivo?: string
): Promise<Resultado> {
  try {
    const l = await prisma.locacao.findUnique({ where: { id }, include: { obra: true } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação devolvida não pode ser transferida.' }
    if (l.obraId === obraDestinoId) return { ok: false, erro: 'A obra de destino é a mesma da origem.' }
    if (dataFim < dataInicio) return { ok: false, erro: 'A data de fim é anterior à de início.' }

    const destino = await prisma.obra.findUnique({ where: { id: obraDestinoId } })
    if (!destino) return { ok: false, erro: 'Obra de destino não encontrada.' }

    await prisma.locacao.update({
      where: { id },
      data: {
        obraId: obraDestinoId,
        dataInicio, dataFim,
        obraAConfirmar: false,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.TRANSFERENCIA,
            descricaoHumana:
              `Transferida de ${l.obra.codigo} para ${destino.codigo}` +
              ` — novo período ${dataBR(dataInicio)} a ${dataBR(dataFim)}` +
              (motivo ? ` · ${motivo}` : ''),
            payloadAntes: JSON.stringify({ obra: l.obra.codigo, dataInicio: l.dataInicio, dataFim: l.dataFim }),
            payloadDepois: JSON.stringify({ obra: destino.codigo, dataInicio, dataFim }),
          },
        },
      },
    })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao transferir' }
  }
}

export async function reclassificarEmLote(ids: string[], obraDestinoId: string): Promise<Resultado<{ movidas: number }>> {
  if (!ids.length) return { ok: false, erro: 'Nenhum item selecionado.' }
  try {
    const destino = await prisma.obra.findUnique({ where: { id: obraDestinoId } })
    if (!destino) return { ok: false, erro: 'Obra de destino não encontrada.' }

    await prisma.$transaction([
      prisma.locacao.updateMany({
        where: { id: { in: ids } },
        data: { obraId: obraDestinoId, obraAConfirmar: false },
      }),
      prisma.movimentacao.createMany({
        data: ids.map((locacaoId) => ({
          locacaoId,
          tipo: MOVIMENTACAO.RECLASSIFICACAO,
          descricaoHumana: `Obra confirmada como ${destino.codigo}`,
        })),
      }),
    ])
    revalidar()
    return { ok: true, dados: { movidas: ids.length } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao reclassificar' }
  }
}
```

Repare em `devolverLocacao`: a linha continua existindo, `dataInicio` é preservada e a movimentação registra quantos dias o equipamento ficou na obra. É exatamente a informação que os 61 registros do bloco `DEVOLUÇÕES` da planilha perderam.

- [ ] **Passo 2: Escrever o drawer**

Crie `src/components/locacoes/drawer-locacao.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { carregarLocacao } from '@/actions/locacoes'
import { brl, dataBR } from '@/lib/dominio/formato'
import { valorTotal, duracaoEmDias, periodoPorDias } from '@/lib/dominio/periodo'
import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { ROTULO_STATUS } from '@/lib/dominio/constantes'

type Detalhe = NonNullable<Awaited<ReturnType<typeof carregarLocacao>>>

type Props = {
  id: string | null
  aoFechar: () => void
  aoAgir: (acao: 'editar' | 'renovar' | 'devolver' | 'transferir', detalhe: Detalhe) => void
}

export function DrawerLocacao({ id, aoFechar, aoAgir }: Props) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [aba, setAba] = useState<'dados' | 'historico'>('dados')

  useEffect(() => {
    if (!id) return setDetalhe(null)
    setAba('dados')
    carregarLocacao(id).then(setDetalhe)
  }, [id])

  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aoFechar])

  if (!id) return null

  const status = detalhe ? calcularStatus({ dataFim: detalhe.dataFim, devolvidaEm: detalhe.devolvidaEm }) : null
  const dias = detalhe ? duracaoEmDias(detalhe.dataInicio, detalhe.dataFim) : 0

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={aoFechar} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-label="Detalhes da locação" data-testid="drawer-locacao"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card sm:max-w-md"
      >
        {!detalhe ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{detalhe.descricao}</h2>
                <p className="text-xs text-muted-foreground">
                  {detalhe.obra.cliente} · {detalhe.obra.codigo}
                  {detalhe.trCodigo ? ` · Tr ${detalhe.trCodigo}` : ''}
                </p>
              </div>
              <button type="button" onClick={aoFechar} aria-label="Fechar"
                      className="grid size-8 shrink-0 place-items-center rounded-md border border-border">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex border-b border-border" role="tablist">
              {(['dados', 'historico'] as const).map((a) => (
                <button
                  key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                    aba === a ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {a === 'dados' ? 'Dados' : `Histórico (${detalhe.movimentacoes.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {aba === 'dados' ? (
                <dl className="space-y-3 text-sm">
                  {[
                    ['Situação', status ? ROTULO_STATUS[status] : '—'],
                    ['Vencimento', detalhe.devolvidaEm ? `devolvida em ${dataBR(detalhe.devolvidaEm)}` : rotuloVencimento(detalhe.dataFim)],
                    ['Período', `${dataBR(detalhe.dataInicio)} a ${dataBR(detalhe.dataFim)}`],
                    ['Duração', dias ? `${dias} dias · ${periodoPorDias(dias)}` : '—'],
                    ['Fornecedor', detalhe.fornecedor ? `${detalhe.fornecedor.nome}${detalhe.fornecedor.telefone ? ` · ${detalhe.fornecedor.telefone}` : ''}` : '—'],
                    ['Quantidade', String(detalhe.quantidade)],
                    ['Estado do item', detalhe.estado],
                    ['Valor do item', brl(detalhe.valorItem)],
                    ['Valor total', brl(valorTotal(detalhe.valorItem, detalhe.dataInicio, detalhe.dataFim))],
                    ['Observações', detalhe.observacoes ?? '—'],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                      <dt className="text-muted-foreground">{rotulo}</dt>
                      <dd className="text-right font-medium">{valor}</dd>
                    </div>
                  ))}
                  {detalhe.obraAConfirmar && (
                    <p className="rounded-md border border-amber-600/50 bg-amber-600/10 p-3 text-xs">
                      Obra a confirmar: este item veio de uma aba compartilhada por mais de uma obra.
                      Use Transferir para definir a obra correta.
                    </p>
                  )}
                </dl>
              ) : (
                <ol data-testid="historico" className="space-y-3">
                  {detalhe.movimentacoes.map((m) => (
                    <li key={m.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm">{m.descricaoHumana}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.tipo.toLowerCase()} · {dataBR(m.criadoEm)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {!detalhe.devolvidaEm && (
              <footer className="grid grid-cols-2 gap-2 border-t border-border p-4">
                <button onClick={() => aoAgir('editar', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Editar</button>
                <button onClick={() => aoAgir('renovar', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Renovar</button>
                <button onClick={() => aoAgir('transferir', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Transferir</button>
                <button onClick={() => aoAgir('devolver', detalhe)}
                        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Devolver</button>
              </footer>
            )}
          </>
        )}
      </aside>
    </>
  )
}
```

- [ ] **Passo 3: Escrever o painel que costura tudo**

Crie `src/components/locacoes/painel-locacoes.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TabelaLocacoes } from './tabela-locacoes'
import { DrawerLocacao } from './drawer-locacao'
import { DialogAcao, type Acao } from './dialog-acao'
import { AcoesLote } from './acoes-lote'
import type { LocacaoListada } from '@/queries/locacoes'

type Props = {
  itens: LocacaoListada[]
  obras: { id: string; codigo: string; cliente: string }[]
  itemInicial?: string
}

export function PainelLocacoes({ itens, obras, itemInicial }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState<string | null>(itemInicial ?? null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [acao, setAcao] = useState<{ tipo: Acao; id: string } | null>(null)

  function selecionar(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      marcado ? novo.add(id) : novo.delete(id)
      return novo
    })
  }

  function concluido() {
    setAcao(null)
    setAberto(null)
    setSelecionados(new Set())
    router.refresh()
  }

  return (
    <>
      {selecionados.size > 0 && (
        <AcoesLote
          ids={[...selecionados]} obras={obras}
          aoLimpar={() => setSelecionados(new Set())}
          aoConcluir={concluido}
        />
      )}

      <TabelaLocacoes
        itens={itens} selecionados={selecionados}
        aoSelecionar={selecionar} aoAbrir={setAberto}
      />

      <DrawerLocacao
        id={aberto} aoFechar={() => setAberto(null)}
        aoAgir={(tipo, detalhe) => setAcao({ tipo, id: detalhe.id })}
      />

      {acao && (
        <DialogAcao
          acao={acao.tipo} locacaoId={acao.id} obras={obras}
          aoFechar={() => setAcao(null)} aoConcluir={concluido}
        />
      )}
    </>
  )
}
```

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: drawer de detalhe com aba de histórico de movimentações"
```

---

## Task 16: Formulário de registro e diálogos de ação

**Arquivos:**
- Criar: `src/components/locacoes/form-locacao.tsx`, `src/components/locacoes/dialog-acao.tsx`, `src/components/locacoes/acoes-lote.tsx`
- Criar: `src/app/locacoes/nova/page.tsx`

O seletor de período rápido é o atalho que a equipe já usava no Tkinter: escolher "Mensal (30 dias)" preenche a data de fim a partir da de início.

- [ ] **Passo 1: Escrever o formulário**

Crie `src/components/locacoes/form-locacao.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addDays, format } from 'date-fns'
import { criarLocacao } from '@/actions/locacoes'
import { PERIODOS } from '@/lib/dominio/constantes'

type Props = {
  obras: { id: string; codigo: string; cliente: string }[]
  fornecedores: { id: string; nome: string }[]
}

const hoje = () => format(new Date(), 'yyyy-MM-dd')

export function FormLocacao({ obras, fornecedores }: Props) {
  const router = useRouter()
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aplicarPeriodo(dias: number) {
    if (!dias) return
    setFim(format(addDays(new Date(`${inicio}T12:00:00`), dias), 'yyyy-MM-dd'))
  }

  function enviar(formData: FormData) {
    setErro(null)
    iniciar(async () => {
      const r = await criarLocacao({
        obraId: formData.get('obraId'),
        descricao: formData.get('descricao'),
        trCodigo: formData.get('trCodigo'),
        fornecedorId: formData.get('fornecedorId'),
        quantidade: formData.get('quantidade'),
        dataInicio: formData.get('dataInicio'),
        dataFim: formData.get('dataFim'),
        valorItem: formData.get('valorItem') || undefined,
        observacoes: formData.get('observacoes'),
      })
      if (!r.ok) return setErro(r.erro)
      router.push('/locacoes')
      router.refresh()
    })
  }

  const campo = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  const rotulo = 'mb-1 block text-sm font-medium'

  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      {erro && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div>
        <label htmlFor="obraId" className={rotulo}>Obra *</label>
        <select id="obraId" name="obraId" required className={campo} defaultValue="">
          <option value="" disabled>Selecione a obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="descricao" className={rotulo}>Equipamento *</label>
        <input id="descricao" name="descricao" required placeholder="MARTELETE 11KG" className={campo} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="trCodigo" className={rotulo}>Código Tr</label>
          <input id="trCodigo" name="trCodigo" className={campo} />
        </div>
        <div>
          <label htmlFor="quantidade" className={rotulo}>Quantidade</label>
          <input id="quantidade" name="quantidade" type="number" min="1" defaultValue="1" className={campo} />
        </div>
        <div>
          <label htmlFor="fornecedorId" className={rotulo}>Fornecedor</label>
          <select id="fornecedorId" name="fornecedorId" className={campo} defaultValue="">
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Período</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="periodo" className={rotulo}>Período rápido</label>
            <select id="periodo" className={campo} defaultValue=""
                    onChange={(e) => aplicarPeriodo(Number(e.target.value))}>
              <option value="">Personalizado</option>
              {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dataInicio" className={rotulo}>Início *</label>
            <input id="dataInicio" name="dataInicio" type="date" required
                   value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="dataFim" className={rotulo}>Fim *</label>
            <input id="dataFim" name="dataFim" type="date" required
                   value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="valorItem" className={rotulo}>Valor do item (R$)</label>
          <input id="valorItem" name="valorItem" type="number" step="0.01" min="0" className={campo} />
        </div>
        <div>
          <label htmlFor="observacoes" className={rotulo}>Observações</label>
          <input id="observacoes" name="observacoes" className={campo} />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={pendente}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pendente ? 'Registrando...' : 'Registrar locação'}
        </button>
        <button type="button" onClick={() => router.back()}
                className="rounded-md border border-border px-4 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Passo 2: Escrever a página de registro**

Crie `src/app/locacoes/nova/page.tsx`:

```tsx
import { FormLocacao } from '@/components/locacoes/form-locacao'
import { opcoesDeFiltro } from '@/queries/locacoes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nova locação — Painel SC' }

export default async function NovaLocacaoPage() {
  const { obras, fornecedores } = await opcoesDeFiltro()
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Nova locação</h1>
      <FormLocacao obras={obras} fornecedores={fornecedores} />
    </div>
  )
}
```

- [ ] **Passo 3: Escrever o diálogo de ações**

Crie `src/components/locacoes/dialog-acao.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { devolverLocacao, renovarLocacao, transferirLocacao } from '@/actions/locacoes'

export type Acao = 'editar' | 'renovar' | 'devolver' | 'transferir'

type Props = {
  acao: Acao
  locacaoId: string
  obras: { id: string; codigo: string; cliente: string }[]
  aoFechar: () => void
  aoConcluir: () => void
}

const TITULOS: Record<Acao, string> = {
  editar: 'Editar locação',
  renovar: 'Renovar período',
  devolver: 'Registrar devolução',
  transferir: 'Transferir para outra obra',
}

export function DialogAcao({ acao, locacaoId, obras, aoFechar, aoConcluir }: Props) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(formData: FormData) {
    setErro(null)
    iniciar(async () => {
      let r
      if (acao === 'renovar') {
        const dias = formData.get('dias')
        r = await renovarLocacao(locacaoId, dias ? Number(dias) : undefined)
      } else if (acao === 'devolver') {
        r = await devolverLocacao(
          locacaoId,
          new Date(`${formData.get('data')}T12:00:00Z`),
          String(formData.get('motivo') || '') || undefined
        )
      } else if (acao === 'transferir') {
        r = await transferirLocacao(
          locacaoId,
          String(formData.get('obraDestinoId')),
          new Date(`${formData.get('inicio')}T12:00:00Z`),
          new Date(`${formData.get('fim')}T12:00:00Z`),
          String(formData.get('motivo') || '') || undefined
        )
      } else {
        return setErro('Use o formulário de edição na página da locação.')
      }
      if (!r.ok) return setErro(r.erro)
      aoConcluir()
    })
  }

  const campo = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  const rotulo = 'mb-1 block text-sm font-medium'
  const hoje = format(new Date(), 'yyyy-MM-dd')

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={aoFechar} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={TITULOS[acao]} data-testid={`dialog-${acao}`}
           className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2
                      rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="mb-4 font-semibold">{TITULOS[acao]}</h2>

        {erro && (
          <div role="alert" className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        <form action={enviar} className="space-y-3">
          {acao === 'renovar' && (
            <div>
              <label htmlFor="dias" className={rotulo}>Dias a acrescentar</label>
              <input id="dias" name="dias" type="number" min="1" placeholder="Deixe vazio para repetir o período atual" className={campo} />
              <p className="mt-1 text-xs text-muted-foreground">
                Em branco, renova pela mesma duração do período vigente.
              </p>
            </div>
          )}

          {acao === 'devolver' && (
            <>
              <div>
                <label htmlFor="data" className={rotulo}>Data da devolução *</label>
                <input id="data" name="data" type="date" required defaultValue={hoje} className={campo} />
              </div>
              <div>
                <label htmlFor="motivo" className={rotulo}>Motivo</label>
                <input id="motivo" name="motivo" className={campo} />
              </div>
            </>
          )}

          {acao === 'transferir' && (
            <>
              <div>
                <label htmlFor="obraDestinoId" className={rotulo}>Obra de destino *</label>
                <select id="obraDestinoId" name="obraDestinoId" required className={campo} defaultValue="">
                  <option value="" disabled>Selecione</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inicio" className={rotulo}>Início *</label>
                  <input id="inicio" name="inicio" type="date" required defaultValue={hoje} className={campo} />
                </div>
                <div>
                  <label htmlFor="fim" className={rotulo}>Fim *</label>
                  <input id="fim" name="fim" type="date" required className={campo} />
                </div>
              </div>
              <div>
                <label htmlFor="motivo" className={rotulo}>Motivo</label>
                <input id="motivo" name="motivo" className={campo} />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={pendente}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {pendente ? 'Aplicando...' : 'Confirmar'}
            </button>
            <button type="button" onClick={aoFechar}
                    className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          </div>
        </form>
      </div>
    </>
  )
}
```

- [ ] **Passo 4: Escrever a barra de ações em lote**

Crie `src/components/locacoes/acoes-lote.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { reclassificarEmLote } from '@/actions/locacoes'

type Props = {
  ids: string[]
  obras: { id: string; codigo: string; cliente: string }[]
  aoLimpar: () => void
  aoConcluir: () => void
}

export function AcoesLote({ ids, obras, aoLimpar, aoConcluir }: Props) {
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function mover() {
    setErro(null)
    iniciar(async () => {
      const r = await reclassificarEmLote(ids, destino)
      if (!r.ok) return setErro(r.erro)
      aoConcluir()
    })
  }

  return (
    <div data-testid="acoes-lote"
         className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <span className="text-sm font-medium">{ids.length} selecionado{ids.length > 1 ? 's' : ''}</span>

      <select aria-label="Mover para a obra" value={destino} onChange={(e) => setDestino(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
        <option value="">Mover para a obra...</option>
        {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
      </select>

      <button type="button" onClick={mover} disabled={!destino || pendente}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pendente ? 'Movendo...' : 'Mover'}
      </button>

      <button type="button" onClick={aoLimpar} className="text-sm text-muted-foreground hover:text-foreground">
        Limpar seleção
      </button>

      {erro && <span role="alert" className="text-sm text-destructive">{erro}</span>}
    </div>
  )
}
```

- [ ] **Passo 5: Verificar o ciclo completo à mão**

```bash
npm run dev
```

Em `http://localhost:3000/locacoes`:
1. Clique num equipamento — o drawer abre com as abas Dados e Histórico, e o histórico mostra a movimentação de importação.
2. Renovar sem informar dias — a data de fim avança pela mesma duração e o histórico ganha uma linha "Renovada por N dias".
3. Transferir para outra obra — o item some do filtro da obra anterior e o histórico registra origem e destino.
4. Devolver — o item sai da lista padrão, aparece com filtro `Devolvida`, e o histórico diz quantos dias ficou na obra.
5. Filtre por `aConfirmar=1`, marque vários itens, escolha a obra e clique em Mover — os 110 caem.

- [ ] **Passo 6: Commit**

```bash
git add -A
git commit -m "feat: registro, renovação, devolução, transferência e reclassificação em lote"
```

---

## Task 17: CRUD de obras e fornecedores

**Arquivos:**
- Criar: `src/actions/obras.ts`, `src/actions/fornecedores.ts`
- Criar: `src/app/obras/page.tsx`, `src/app/fornecedores/page.tsx`
- Criar: `src/components/cadastro/tabela-cadastro.tsx`

Resolve de vez a lista fixa no código: as 11 obras e os 22 fornecedores passam a ser editáveis pela interface.

- [ ] **Passo 1: Escrever as actions de obra**

Crie `src/actions/obras.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquema = z.object({
  cliente: z.string().trim().min(2, 'Informe o cliente.'),
  codigo: z.string().trim().min(2, 'Informe o código da obra.'),
  descricao: z.string().trim().min(2, 'Informe a descrição.'),
  responsavel: z.string().trim().optional(),
})

export async function salvarObra(id: string | null, entrada: unknown): Promise<Resultado> {
  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const d = { ...parsed.data, responsavel: parsed.data.responsavel || null }

  try {
    if (id) {
      await prisma.obra.update({ where: { id }, data: d })
    } else {
      await prisma.obra.create({ data: { ...d, abaOrigem: d.codigo } })
    }
    revalidatePath('/obras')
    revalidatePath('/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe uma obra com o código ${d.codigo}.`
      : e instanceof Error ? e.message : 'Falha ao salvar a obra'
    return { ok: false, erro: msg }
  }
}

export async function alternarObra(id: string, ativa: boolean): Promise<Resultado> {
  try {
    if (!ativa) {
      const emUso = await prisma.locacao.count({ where: { obraId: id, devolvidaEm: null } })
      if (emUso > 0) {
        return { ok: false, erro: `Esta obra tem ${emUso} locações em aberto. Devolva ou transfira antes de desativar.` }
      }
    }
    await prisma.obra.update({ where: { id }, data: { ativa } })
    revalidatePath('/obras')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a obra' }
  }
}

export async function listarObras() {
  return prisma.obra.findMany({
    orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
    include: { _count: { select: { locacoes: true } } },
  })
}
```

A recusa em desativar obra com locações em aberto é o tipo de guarda que o app Python não tinha — lá, apagar era sempre possível e sempre silencioso.

- [ ] **Passo 2: Escrever as actions de fornecedor**

Crie `src/actions/fornecedores.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do fornecedor.'),
  telefone: z.string().trim().optional(),
  aliases: z.string().trim().optional(),
})

export async function salvarFornecedor(id: string | null, entrada: unknown): Promise<Resultado> {
  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  const { nome, telefone, aliases } = parsed.data
  const listaAliases = (aliases ?? '')
    .split(',').map((a) => a.trim()).filter(Boolean)

  try {
    const fornecedor = id
      ? await prisma.fornecedor.update({ where: { id }, data: { nome, telefone: telefone || null } })
      : await prisma.fornecedor.create({ data: { nome, telefone: telefone || null } })

    await prisma.fornecedorAlias.deleteMany({ where: { fornecedorId: fornecedor.id } })
    for (const alias of listaAliases) {
      await prisma.fornecedorAlias.upsert({
        where: { alias },
        update: { fornecedorId: fornecedor.id },
        create: { alias, fornecedorId: fornecedor.id },
      })
    }

    revalidatePath('/fornecedores')
    revalidatePath('/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe um fornecedor chamado ${nome}, ou um dos apelidos já pertence a outro.`
      : e instanceof Error ? e.message : 'Falha ao salvar o fornecedor'
    return { ok: false, erro: msg }
  }
}

export async function alternarFornecedor(id: string, ativo: boolean): Promise<Resultado> {
  try {
    await prisma.fornecedor.update({ where: { id }, data: { ativo } })
    revalidatePath('/fornecedores')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o fornecedor' }
  }
}

export async function listarFornecedores() {
  return prisma.fornecedor.findMany({
    orderBy: { nome: 'asc' },
    include: { aliases: { select: { alias: true } }, _count: { select: { locacoes: true } } },
  })
}
```

- [ ] **Passo 3: Escrever a tabela de cadastro reutilizável**

Crie `src/components/cadastro/tabela-cadastro.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'

export type CampoCadastro = {
  nome: string
  rotulo: string
  obrigatorio?: boolean
  dica?: string
}

export type LinhaCadastro = {
  id: string
  ativo: boolean
  valores: Record<string, string>
  usos: number
  colunas: string[]
}

type Props = {
  titulo: string
  campos: CampoCadastro[]
  linhas: LinhaCadastro[]
  cabecalhos: string[]
  aoSalvar: (id: string | null, dados: Record<string, string>) => Promise<{ ok: boolean; erro?: string }>
  aoAlternar: (id: string, ativo: boolean) => Promise<{ ok: boolean; erro?: string }>
}

export function TabelaCadastro({ titulo, campos, linhas, cabecalhos, aoSalvar, aoAlternar }: Props) {
  const [editando, setEditando] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar(id: string | null, formData: FormData) {
    setErro(null)
    const dados = Object.fromEntries(campos.map((c) => [c.nome, String(formData.get(c.nome) ?? '')]))
    iniciar(async () => {
      const r = await aoSalvar(id, dados)
      if (!r.ok) return setErro(r.erro ?? 'Falha ao salvar')
      setEditando(null); setCriando(false)
    })
  }

  function alternar(id: string, ativo: boolean) {
    setErro(null)
    iniciar(async () => {
      const r = await aoAlternar(id, ativo)
      if (!r.ok) setErro(r.erro ?? 'Falha ao alterar')
    })
  }

  const campoClasse = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

  const Formulario = ({ id, valores }: { id: string | null; valores?: Record<string, string> }) => (
    <form action={(fd) => salvar(id, fd)} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((c) => (
          <div key={c.nome}>
            <label htmlFor={`${id ?? 'novo'}-${c.nome}`} className="mb-1 block text-sm font-medium">
              {c.rotulo}{c.obrigatorio ? ' *' : ''}
            </label>
            <input
              id={`${id ?? 'novo'}-${c.nome}`} name={c.nome} required={c.obrigatorio}
              defaultValue={valores?.[c.nome] ?? ''} className={campoClasse}
            />
            {c.dica && <p className="mt-1 text-xs text-muted-foreground">{c.dica}</p>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pendente}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Salvar
        </button>
        <button type="button" onClick={() => { setEditando(null); setCriando(false); setErro(null) }}
                className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
      </div>
    </form>
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        {!criando && (
          <button type="button" onClick={() => { setCriando(true); setEditando(null) }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" /> Novo
          </button>
        )}
      </header>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {criando && <Formulario id={null} />}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {cabecalhos.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
              <th className="px-3 py-2 text-right font-medium">Locações</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className={`border-b border-border/50 ${l.ativo ? '' : 'opacity-50'}`}>
                {l.colunas.map((v, i) => <td key={i} className="px-3 py-2">{v || '—'}</td>)}
                <td className="px-3 py-2 text-right tabular">{l.usos}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => { setEditando(l.id); setCriando(false) }}
                          className="mr-3 text-xs text-primary hover:underline">Editar</button>
                  <button type="button" onClick={() => alternar(l.id, !l.ativo)} disabled={pendente}
                          className="text-xs text-muted-foreground hover:underline">
                    {l.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Formulario id={editando} valores={linhas.find((l) => l.id === editando)?.valores} />
      )}
    </div>
  )
}
```

- [ ] **Passo 4: Escrever a página de obras**

Crie `src/app/obras/page.tsx`:

```tsx
import { TabelaCadastro } from '@/components/cadastro/tabela-cadastro'
import { alternarObra, listarObras, salvarObra } from '@/actions/obras'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Obras — Painel SC' }

export default async function ObrasPage() {
  const obras = await listarObras()

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <TabelaCadastro
        titulo="Obras"
        cabecalhos={['Cliente', 'Código', 'Descrição', 'Responsável']}
        campos={[
          { nome: 'cliente', rotulo: 'Cliente', obrigatorio: true },
          { nome: 'codigo', rotulo: 'Código da obra', obrigatorio: true, dica: 'Ex.: SC-1017-26' },
          { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
          { nome: 'responsavel', rotulo: 'Responsável' },
        ]}
        linhas={obras.map((o) => ({
          id: o.id,
          ativo: o.ativa,
          usos: o._count.locacoes,
          colunas: [o.cliente, o.codigo, o.descricao, o.responsavel ?? ''],
          valores: {
            cliente: o.cliente, codigo: o.codigo,
            descricao: o.descricao, responsavel: o.responsavel ?? '',
          },
        }))}
        aoSalvar={async (id, dados) => {
          'use server'
          const r = await salvarObra(id, dados)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
        aoAlternar={async (id, ativo) => {
          'use server'
          const r = await alternarObra(id, ativo)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
      />
    </div>
  )
}
```

- [ ] **Passo 5: Escrever a página de fornecedores**

Crie `src/app/fornecedores/page.tsx`:

```tsx
import { TabelaCadastro } from '@/components/cadastro/tabela-cadastro'
import { alternarFornecedor, listarFornecedores, salvarFornecedor } from '@/actions/fornecedores'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fornecedores — Painel SC' }

export default async function FornecedoresPage() {
  const fornecedores = await listarFornecedores()

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Os apelidos existem para a importação: se a planilha escreve <code>KAISEN</code> e o cadastro
        diz <code>KAISEN LOCAÇÕES</code>, o apelido faz os dois virarem o mesmo fornecedor em vez de dois.
      </p>

      <TabelaCadastro
        titulo="Fornecedores"
        cabecalhos={['Nome', 'Telefone', 'Apelidos']}
        campos={[
          { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
          { nome: 'telefone', rotulo: 'Telefone' },
          { nome: 'aliases', rotulo: 'Apelidos', dica: 'Separados por vírgula. Ex.: KAISEN, KAISEN LOCACOES' },
        ]}
        linhas={fornecedores.map((f) => ({
          id: f.id,
          ativo: f.ativo,
          usos: f._count.locacoes,
          colunas: [f.nome, f.telefone ?? '', f.aliases.map((a) => a.alias).join(', ')],
          valores: {
            nome: f.nome, telefone: f.telefone ?? '',
            aliases: f.aliases.map((a) => a.alias).join(', '),
          },
        }))}
        aoSalvar={async (id, dados) => {
          'use server'
          const r = await salvarFornecedor(id, dados)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
        aoAlternar={async (id, ativo) => {
          'use server'
          const r = await alternarFornecedor(id, ativo)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
      />
    </div>
  )
}
```

- [ ] **Passo 6: Verificar**

```bash
npm run dev
```

Em `/obras`: 11 obras com a contagem de locações de cada uma. Tente desativar `SC-1176-25` (54 locações) — deve recusar com a mensagem sobre locações em aberto. Em `/fornecedores`: 22 fornecedores com telefone e apelidos; edite um e confirme que os apelidos persistem.

- [ ] **Passo 7: Rodar o lint e o build**

```bash
npm run lint && npm run build
```

Esperado: build concluída sem erro de tipo. Erros de `any` implícito nos formatadores do Recharts são o achado mais provável aqui — tipe o parâmetro em vez de silenciar a regra.

- [ ] **Passo 8: Commit**

```bash
git add -A
git commit -m "feat: CRUD de obras e fornecedores com apelidos de normalização"
```

---

A Fase 4 (exportação .xlsx e PDF) e a Fase 5 (testes Playwright) continuam em
`docs/plans/2026-07-31-painel-locacao-mvp-parte3.md`.
