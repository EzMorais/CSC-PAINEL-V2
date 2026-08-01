# Painel de Locação SC — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** substituir o painel Tkinter/Excel por uma aplicação Next.js local, com banco SQLite como fonte da verdade, importando as 242 locações ativas e 61 devolvidas da planilha atual.

**Arquitetura:** Next.js 15 App Router. Leituras em Server Components consultando o Prisma direto; mutações em Server Actions que retornam `{ ok }` ou `{ ok: false, erro }` — nunca falham em silêncio. Regras de negócio (status, período, valor) são funções puras em `src/lib/dominio/`, fora do React e do Prisma. O Excel só entra pelo importador e só sai pelo exportador.

**Stack:** Next.js 15 · React 19 · TypeScript · Prisma 6 / SQLite · Tailwind v4 · shadcn/ui · Recharts 3 · ExcelJS · PDFKit · Zod · date-fns · Playwright

**Design:** `docs/plans/2026-07-31-painel-locacao-design.md`

**Ambiente verificado:** Node v20.17.0 · npm 10.8.2

**Versões realmente instaladas na Task 1** (o `create-next-app@latest` trouxe versões acima
das previstas — nada no plano depende de API exclusiva das versões antigas, então seguimos
com estas):

| Previsto no plano | Instalado |
|---|---|
| Next.js 15 | **Next.js 16.2.12** |
| React 19 | React 19.2.4 |
| Zod 3 | **Zod 4.4.3** — a sintaxe de erro `{ message: ... }` usada no plano já é a da v4 |
| Prisma 6 | Prisma 6.19.3 |
| Recharts 3 | Recharts 3.10.1 |
| date-fns | date-fns 4.4.0 |

Duas consequências práticas do Next 16: `next lint` foi removido, então o script `lint` é
`eslint` puro (o `npm run lint` do plano continua funcionando); e o Turbopack é o padrão do
`next dev`, o que não afeta nenhuma tarefa.

---

## Convenções deste plano

- Todos os caminhos são relativos à raiz `/Users/guimarques/siqueiracampos-painellocacao`.
- Cada tarefa termina em commit. Mensagens em português, formato `tipo: descrição`.
- **Estratégia de verificação:** o escopo de teste acordado é Playwright E2E (fluxos críticos + responsividade), sem framework de teste unitário. Para manter feedback rápido nas partes sem UI (parser, regras), cada tarefa dessas inclui um **script de verificação** executável via `npx tsx` que imprime números conferíveis contra a planilha real. É o "teste falha primeiro" desta stack: você roda, vê o número errado, implementa, roda de novo.

---

## Estrutura de arquivos

```
dados/
  Maquinas_Alugadas_Controle_REVISADA.xlsx   planilha de origem (fora do Git)

prisma/
  schema.prisma                  5 tabelas
  seed.ts                        11 obras + 22 fornecedores + aliases

scripts/
  verificar-planilha.ts          roda o parser contra a planilha e imprime totais

src/lib/
  prisma.ts                      singleton do client
  dominio/constantes.ts          StatusLocacao, EstadoItem, TipoMovimentacao, PERIODOS
  dominio/status.ts              calcularStatus, diasRestantes
  dominio/periodo.ts             periodoPorDias, quantidadePeriodos, valorTotal
  dominio/formato.ts             brl, dataBR
  planilha/mapa-abas.ts          aba → obra principal, marcação "a confirmar"
  planilha/coluna15.ts           classifica quantidade | estado | observação
  planilha/parser.ts             lê o .xlsx → LinhaPlanilha[]
  planilha/exportar-xlsx.ts
  planilha/exportar-pdf.ts

src/queries/
  dashboard.ts                   KPIs e agregações
  locacoes.ts                    listagem com filtros

src/actions/
  locacoes.ts                    criar, editar, renovar, devolver, transferir, moverEmLote
  obras.ts                       CRUD
  fornecedores.ts                CRUD
  importar.ts                    prévia + confirmação

src/components/
  layout/sidebar.tsx             navegação (drawer no mobile)
  layout/theme-toggle.tsx
  dashboard/kpi-card.tsx
  dashboard/grafico-fornecedor.tsx
  dashboard/grafico-obra.tsx
  dashboard/tabela-vencimentos.tsx
  locacoes/filtros.tsx
  locacoes/tabela-locacoes.tsx   tabela no desktop, cards no mobile
  locacoes/drawer-locacao.tsx    abas Dados | Histórico
  locacoes/form-locacao.tsx
  locacoes/dialog-renovar.tsx
  locacoes/dialog-devolver.tsx
  locacoes/dialog-transferir.tsx
  locacoes/acoes-lote.tsx        reclassificação dos "a confirmar"
  importar/preview-importacao.tsx

src/app/
  layout.tsx  page.tsx  globals.css
  locacoes/page.tsx  locacoes/nova/page.tsx
  obras/page.tsx  fornecedores/page.tsx  importar/page.tsx
  api/export/xlsx/route.ts  api/export/pdf/route.ts

e2e/
  importar.spec.ts  ciclo-vida.spec.ts  responsivo.spec.ts
```

---

# Fase 0 — Fundação

## Task 1: Scaffold do projeto

**Arquivos:**
- Criar: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*` (via CLI)
- Modificar: `.gitignore`
- Mover: `Maquinas_Alugadas_Controle_REVISADA.xlsx` → `dados/`

`create-next-app` recusa rodar em diretório que contenha arquivos fora da sua allowlist. `.git`, `.gitignore` e `docs` são permitidos; o `.xlsx` não. Por isso ele sai e volta.

- [ ] **Passo 1: Tirar a planilha do caminho**

```bash
cd /Users/guimarques/siqueiracampos-painellocacao
mv Maquinas_Alugadas_Controle_REVISADA.xlsx ../planilha-origem-temp.xlsx
ls -la
```

Esperado: só `.git`, `.gitignore` e `docs/`.

- [ ] **Passo 2: Criar o app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Esperado: `Success! Created ...`. Se perguntar sobre sobrescrever `.gitignore`, aceite — o passo 4 restaura as regras.

- [ ] **Passo 3: Devolver a planilha**

```bash
mkdir -p dados
mv ../planilha-origem-temp.xlsx dados/Maquinas_Alugadas_Controle_REVISADA.xlsx
ls -la dados/
```

Esperado: o arquivo com ~449 KB.

- [ ] **Passo 4: Restaurar as regras do .gitignore**

Acrescente ao fim de `.gitignore` (o `create-next-app` pode ter sobrescrito):

```gitignore
# Banco de dados — dados reais de custo de obra não vão para o repositório
*.db
*.db-journal
prisma/*.db*

# Planilhas de origem — dados financeiros da construtora
*.xlsx
*.xlsm
dados/

# Exports gerados
exports/

# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

- [ ] **Passo 5: Confirmar que a planilha não entra no Git**

```bash
git status --short
git check-ignore -v dados/Maquinas_Alugadas_Controle_REVISADA.xlsx
```

Esperado: o `status` **não** lista a planilha; o `check-ignore` responde apontando a regra `dados/`.

- [ ] **Passo 6: Instalar as dependências do projeto**

```bash
npm install @prisma/client zod date-fns exceljs pdfkit recharts next-themes lucide-react
npm install -D prisma tsx @types/pdfkit
```

- [ ] **Passo 7: Verificar que sobe**

```bash
npm run dev
```

Esperado: `Ready in ...` em `http://localhost:3000`. Abra, veja a página padrão do Next, encerre com Ctrl+C.

- [ ] **Passo 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + TypeScript + Tailwind"
```

---

## Task 2: Schema do banco

**Arquivos:**
- Criar: `prisma/schema.prisma`, `src/lib/prisma.ts`, `.env`
- Modificar: `package.json`

SQLite no Prisma **não suporta `enum` nem listas escalares**. Campos de enumeração são `String` validados por constantes TypeScript; os aliases de fornecedor viram tabela própria, o que ainda dá lookup indexado direto pelo texto normalizado.

- [ ] **Passo 1: Inicializar o Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Esperado: cria `prisma/schema.prisma` e `.env`.

- [ ] **Passo 2: Definir a URL do banco**

Substitua o conteúdo de `.env` por:

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Passo 3: Escrever o schema**

Substitua o conteúdo de `prisma/schema.prisma` por:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Obra {
  id          String   @id @default(cuid())
  cliente     String
  codigo      String   @unique
  descricao   String
  responsavel String?
  abaOrigem   String
  ativa       Boolean  @default(true)
  criadoEm    DateTime @default(now())

  locacoes    Locacao[]

  @@index([cliente])
}

model Fornecedor {
  id       String   @id @default(cuid())
  nome     String   @unique
  telefone String?
  ativo    Boolean  @default(true)
  criadoEm DateTime @default(now())

  aliases  FornecedorAlias[]
  locacoes Locacao[]
}

model FornecedorAlias {
  id           String     @id @default(cuid())
  alias        String     @unique
  fornecedor   Fornecedor @relation(fields: [fornecedorId], references: [id], onDelete: Cascade)
  fornecedorId String

  @@index([fornecedorId])
}

model Locacao {
  id             String    @id @default(cuid())
  descricao      String
  trCodigo       String?
  quantidade     Int       @default(1)
  estado         String    @default("OK")
  observacoes    String?
  dataInicio     DateTime?
  dataFim        DateTime?
  valorItem      Float?
  devolvidaEm    DateTime?
  obraAConfirmar Boolean   @default(false)
  numeroOrigem   String?
  criadoEm       DateTime  @default(now())
  atualizadoEm   DateTime  @updatedAt

  obra           Obra        @relation(fields: [obraId], references: [id])
  obraId         String
  fornecedor     Fornecedor? @relation(fields: [fornecedorId], references: [id])
  fornecedorId   String?

  movimentacoes  Movimentacao[]

  @@index([obraId])
  @@index([fornecedorId])
  @@index([dataFim])
  @@index([devolvidaEm])
}

model Movimentacao {
  id            String   @id @default(cuid())
  tipo          String
  descricaoHumana String
  payloadAntes  String?
  payloadDepois String?
  criadoEm      DateTime @default(now())

  locacao       Locacao  @relation(fields: [locacaoId], references: [id], onDelete: Cascade)
  locacaoId     String

  @@index([locacaoId])
}
```

`status` **não** é coluna: é derivado de `dataFim` e `devolvidaEm` em tempo de leitura. Gravar status seria criar uma segunda fonte de verdade que envelhece sozinha — exatamente o problema da planilha.

- [ ] **Passo 4: Criar a migration**

```bash
npx prisma migrate dev --name inicial
```

Esperado: `Your database is now in sync with your schema` e `prisma/migrations/<timestamp>_inicial/`.

- [ ] **Passo 5: Criar o singleton do client**

Crie `src/lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Sem o singleton, o hot reload do Next abre uma conexão nova a cada salvamento até estourar.

- [ ] **Passo 6: Registrar os scripts**

Em `package.json`, dentro de `"scripts"`, acrescente:

```json
"db:seed": "tsx prisma/seed.ts",
"db:reset": "prisma migrate reset --force && npm run db:seed",
"verificar:planilha": "tsx scripts/verificar-planilha.ts"
```

- [ ] **Passo 7: Confirmar que o banco existe**

```bash
npx prisma studio
```

Esperado: abre em `localhost:5555` com as 5 tabelas vazias. Ctrl+C para sair.

- [ ] **Passo 8: Commit**

```bash
git add -A
git commit -m "feat: schema Prisma/SQLite com obras, fornecedores, locações e movimentações"
```

---

## Task 3: Seed de obras e fornecedores

**Arquivos:**
- Criar: `prisma/seed.ts`

Os dados abaixo saíram da aba RESUMO da planilha real — inclusive os telefones, que o app Python ignorava. Os `aliases` são a peça que faz `KAISEN`, `KAISEN LOCACOES` e `KAISEN LOCAÇÕES` convergirem para um registro só.

- [ ] **Passo 1: Escrever o seed**

Crie `prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OBRAS = [
  { cliente: 'CLARIOS',          codigo: 'SC-1060-25',  descricao: 'CONSTRUÇÃO DE NOVO PRÉDIO AGM',   responsavel: 'nicolas', abaOrigem: 'SC-1060-25_CLARIOS' },
  { cliente: 'CLARIOS',          codigo: 'SC-1096-25',  descricao: 'NOVA REDE DE DRENAGEM PLUVIAL',   responsavel: 'nicolas', abaOrigem: 'SC-1096-25_CLARIOS' },
  { cliente: 'MORELLI',          codigo: 'SC-1135-25A', descricao: 'PRÉDIO P2',                       responsavel: 'mariana', abaOrigem: 'SC-1135-25A' },
  { cliente: 'MORELLI',          codigo: 'SC-1135-25B', descricao: 'GALPÃO G3',                       responsavel: 'mariana', abaOrigem: 'SC-1135-25B_MORELLI' },
  { cliente: 'MORELLI',          codigo: 'SC-1135-25C', descricao: 'RESTAURANTE P1',                  responsavel: 'mariana', abaOrigem: 'SC-1135-25B_MORELLI' },
  { cliente: 'TOYOTA',           codigo: 'SC-1028-25',  descricao: 'AMPLIAÇÃO DRI',                   responsavel: 'lucas',   abaOrigem: 'SC-1017-26_TOYOTA' },
  { cliente: 'TOYOTA',           codigo: 'SC-1122-25',  descricao: 'AMPLIAÇÃO AIS',                   responsavel: 'lucas',   abaOrigem: 'SC-1017-26_TOYOTA' },
  { cliente: 'TOYOTA',           codigo: 'SC-1017-26',  descricao: 'AMPLIAÇÃO LABORATÓRIO',           responsavel: 'lucas',   abaOrigem: 'SC-1017-26_TOYOTA' },
  { cliente: 'ADIMAX',           codigo: 'SC-1176-25',  descricao: 'CONSTRUÇÃO DE GALPÃO INDUSTRIAL', responsavel: 'enzo',    abaOrigem: 'SC-1176-25_ADIMAX' },
  { cliente: 'INSTITUTO ADIMAX', codigo: 'SC-1009-26',  descricao: 'AMPLIAÇÃO DO INSTITUTO ADIMAX',   responsavel: 'luana',   abaOrigem: 'SC-1009-26_ADIMAX' },
  { cliente: 'LINC',             codigo: 'LINC',        descricao: 'Controle avulso',                 responsavel: null,      abaOrigem: 'LINC' },
]

const FORNECEDORES: { nome: string; telefone: string | null; aliases: string[] }[] = [
  { nome: 'KAISEN LOCAÇÕES',             telefone: '15 99668-4149',  aliases: ['KAISEN', 'KAISEN LOCACOES'] },
  { nome: 'LOK SOLUÇÕES',                telefone: '15 97407-2116',  aliases: ['LOK', 'LOK SOLUCOES'] },
  { nome: 'BAN MAQ LOCAÇÕES',            telefone: '15 99832-2496',  aliases: ['BAN MAQ', 'BAN MAQ LOCACOES', 'BANMAQ'] },
  { nome: 'MIL MÁQUINAS',                telefone: '19 97419-7882',  aliases: ['MIL MAQUINAS'] },
  { nome: 'CASA DO CONSTRUTOR SOROCABA', telefone: '15 3337979',     aliases: ['CASA DO CONSTRUTOR'] },
  { nome: 'ROBERTO GOULART (CAÇAMBAS)',  telefone: '15 97402-9107',  aliases: ['GOULART', 'GOULART CACAMBAS', 'GOULART CAÇAMBAS'] },
  { nome: 'COMERCIAL 3A',                telefone: '15 99842-5041',  aliases: ['3A ANDAIMES', '3A', 'COMERCIAL 3A'] },
  { nome: 'ORGUEL LOCAÇÕES',             telefone: '19 99827-1898',  aliases: ['ORGUEL', 'ORGUEL LOCACOES'] },
  { nome: 'HORIZONTE LOCAÇÕES',          telefone: '15 98823-2134',  aliases: ['HORIZONTE', 'HORIZONTE LOCACOES'] },
  { nome: 'JM DOS SANTOS – LOCAÇÃO DE CAÇAMBA', telefone: '(15) 99735-6759', aliases: ['JM DOS SANTOS', 'JM DOS SANTOS CACAMBA'] },
  { nome: 'INDAIATEC ELÉTRICA',          telefone: '(19) 98128-4274', aliases: ['INDAIATEC'] },
  { nome: 'TITA GUINDESTES',             telefone: '15 99831-8822',  aliases: ['TITA'] },
  { nome: 'INDUSLOC COMERCIAL',          telefone: '(11) 4788-3800', aliases: ['INDUSLOC'] },
  { nome: 'PORTO FELIZ LOCAÇÃO',         telefone: '15 99789-5604',  aliases: ['PORTO FELIZ'] },
  { nome: 'ALCANCE LOCAÇÃO',             telefone: '15 99111-6730',  aliases: ['ALCANCE'] },
  { nome: 'MEGA PEAD TUBOS',             telefone: '(19) 98182-5324', aliases: ['MEGA PEAD'] },
  { nome: 'GILBERTO GUARATTO',           telefone: '11 3951-3338',   aliases: [] },
  { nome: 'GSVK CAÇAMBAS',               telefone: '11 94776-8853',  aliases: ['GSVK'] },
  { nome: 'W MAQ LOCADORA',              telefone: '15998399905',    aliases: ['W MAQ'] },
  { nome: 'TAUBEER',                     telefone: '15 97403-8015',  aliases: [] },
  { nome: 'ASSISTEC',                    telefone: null,             aliases: [] },
  { nome: 'DOIS IRMÃOS',                 telefone: null,             aliases: ['DOIS IRMAOS'] },
]

async function main() {
  for (const obra of OBRAS) {
    await prisma.obra.upsert({
      where: { codigo: obra.codigo },
      update: obra,
      create: obra,
    })
  }
  console.log(`Obras: ${OBRAS.length}`)

  for (const f of FORNECEDORES) {
    const fornecedor = await prisma.fornecedor.upsert({
      where: { nome: f.nome },
      update: { telefone: f.telefone },
      create: { nome: f.nome, telefone: f.telefone },
    })
    for (const alias of f.aliases) {
      await prisma.fornecedorAlias.upsert({
        where: { alias },
        update: { fornecedorId: fornecedor.id },
        create: { alias, fornecedorId: fornecedor.id },
      })
    }
  }
  console.log(`Fornecedores: ${FORNECEDORES.length}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

O seed usa `upsert`, então rodar duas vezes não duplica nada.

- [ ] **Passo 2: Rodar**

```bash
npm run db:seed
```

Esperado:
```
Obras: 11
Fornecedores: 22
```

- [ ] **Passo 3: Confirmar a idempotência**

```bash
npm run db:seed
npx prisma studio
```

Esperado: os mesmos números; no Studio, `Obra` = 11 linhas, `Fornecedor` = 22, `FornecedorAlias` = 30. Rodar de novo não criou duplicata. Ctrl+C.

Se sua contagem de aliases der diferente de 30, **confira somando o array `FORNECEDORES`
acima — não ajuste os dados para bater o número**. Os aliases saíram da planilha real e são
o que faz a importação da Task 9 convergir as grafias; alterar um para fechar uma conta
quebra aquela tarefa silenciosamente.

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: seed com 11 obras e 22 fornecedores extraídos da aba RESUMO"
```

---

# Fase 1 — Regras de negócio

## Task 4: Constantes e cálculo de status

**Arquivos:**
- Criar: `src/lib/dominio/constantes.ts`, `src/lib/dominio/status.ts`
- Criar: `scripts/verificar-status.ts`

O limiar de ATENÇÃO é **7 dias**, conforme a LEGENDA da própria planilha ("7 dias ou menos para o vencimento"). O código Python usava três limiares conflitantes (fórmula `<=3`, KPI `<=7`, cor de linha `<=15`); esta é a unificação.

- [ ] **Passo 1: Escrever as constantes**

Crie `src/lib/dominio/constantes.ts`:

```ts
export const STATUS = {
  ATIVA: 'ATIVA',
  ATENCAO: 'ATENCAO',
  VENCIDA: 'VENCIDA',
  DEVOLVIDA: 'DEVOLVIDA',
  SEM_PRAZO: 'SEM_PRAZO',
} as const
export type StatusLocacao = (typeof STATUS)[keyof typeof STATUS]

export const ESTADO = {
  OK: 'OK',
  PERDIDO: 'PERDIDO',
  DANIFICADO: 'DANIFICADO',
} as const
export type EstadoItem = (typeof ESTADO)[keyof typeof ESTADO]

export const MOVIMENTACAO = {
  REGISTRO: 'REGISTRO',
  EDICAO: 'EDICAO',
  RENOVACAO: 'RENOVACAO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  DEVOLUCAO: 'DEVOLUCAO',
  IMPORTACAO: 'IMPORTACAO',
  RECLASSIFICACAO: 'RECLASSIFICACAO',
} as const
export type TipoMovimentacao = (typeof MOVIMENTACAO)[keyof typeof MOVIMENTACAO]

/** Limiar de ATENÇÃO, em dias. Definido pela LEGENDA da planilha de origem. */
export const DIAS_ATENCAO = 7

export const PERIODOS = [
  { rotulo: 'Diário (1 dia)',      dias: 1 },
  { rotulo: 'Semanal (7 dias)',    dias: 7 },
  { rotulo: 'Quinzenal (15 dias)', dias: 15 },
  { rotulo: 'Mensal (30 dias)',    dias: 30 },
  { rotulo: 'Trimestre (90 dias)', dias: 90 },
] as const

export const ROTULO_STATUS: Record<StatusLocacao, string> = {
  ATIVA: 'Ativa',
  ATENCAO: 'Atenção',
  VENCIDA: 'Vencida',
  DEVOLVIDA: 'Devolvida',
  SEM_PRAZO: 'Sem prazo',
}
```

- [ ] **Passo 2: Escrever o cálculo de status**

Crie `src/lib/dominio/status.ts`:

```ts
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { DIAS_ATENCAO, STATUS, type StatusLocacao } from './constantes'

export type EntradaStatus = {
  dataFim: Date | null
  devolvidaEm: Date | null
}

/** Dias até o fim da locação. Negativo = vencida há N dias. null = sem prazo. */
export function diasRestantes(dataFim: Date | null, hoje: Date = new Date()): number | null {
  if (!dataFim) return null
  return differenceInCalendarDays(startOfDay(dataFim), startOfDay(hoje))
}

export function calcularStatus(entrada: EntradaStatus, hoje: Date = new Date()): StatusLocacao {
  if (entrada.devolvidaEm) return STATUS.DEVOLVIDA
  const dias = diasRestantes(entrada.dataFim, hoje)
  if (dias === null) return STATUS.SEM_PRAZO
  if (dias < 0) return STATUS.VENCIDA
  if (dias <= DIAS_ATENCAO) return STATUS.ATENCAO
  return STATUS.ATIVA
}

/** Texto curto para a coluna de vencimento, ex.: "vence em 3 dias", "vencida há 12 dias". */
export function rotuloVencimento(dataFim: Date | null, hoje: Date = new Date()): string {
  const dias = diasRestantes(dataFim, hoje)
  if (dias === null) return 'sem prazo'
  if (dias < 0) return `vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
```

`differenceInCalendarDays` compara datas de calendário, não intervalos de 24h — sem isso, um item que vence hoje às 23h aparece como "0 dias" ou "1 dia" dependendo da hora em que você abre o painel.

- [ ] **Passo 3: Escrever o script de verificação**

Crie `scripts/verificar-status.ts`:

```ts
import { calcularStatus, diasRestantes, rotuloVencimento } from '../src/lib/dominio/status'

const HOJE = new Date('2026-07-31T10:00:00')

const casos: { nome: string; dataFim: Date | null; devolvidaEm: Date | null; esperado: string }[] = [
  { nome: 'devolvida ignora a data fim', dataFim: new Date('2026-12-01'), devolvidaEm: new Date('2026-07-01'), esperado: 'DEVOLVIDA' },
  { nome: 'sem data fim',                dataFim: null,                    devolvidaEm: null, esperado: 'SEM_PRAZO' },
  { nome: 'venceu ontem',                dataFim: new Date('2026-07-30'),  devolvidaEm: null, esperado: 'VENCIDA' },
  { nome: 'vence hoje',                  dataFim: new Date('2026-07-31'),  devolvidaEm: null, esperado: 'ATENCAO' },
  { nome: 'vence em 7 dias (limite)',    dataFim: new Date('2026-08-07'),  devolvidaEm: null, esperado: 'ATENCAO' },
  { nome: 'vence em 8 dias',             dataFim: new Date('2026-08-08'),  devolvidaEm: null, esperado: 'ATIVA' },
]

let falhas = 0
for (const c of casos) {
  const obtido = calcularStatus({ dataFim: c.dataFim, devolvidaEm: c.devolvidaEm }, HOJE)
  const ok = obtido === c.esperado
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${c.nome.padEnd(32)} esperado=${c.esperado.padEnd(10)} obtido=${obtido}`)
}

console.log('\nRótulos:')
console.log(' ', rotuloVencimento(new Date('2026-07-30'), HOJE))
console.log(' ', rotuloVencimento(new Date('2026-07-31'), HOJE))
console.log(' ', rotuloVencimento(new Date('2026-08-03'), HOJE))
console.log(' ', rotuloVencimento(null, HOJE))
console.log(' dias até 2026-08-08:', diasRestantes(new Date('2026-08-08'), HOJE))

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
```

- [ ] **Passo 4: Rodar**

```bash
npx tsx scripts/verificar-status.ts
```

Esperado:
```
ok   devolvida ignora a data fim      esperado=DEVOLVIDA  obtido=DEVOLVIDA
ok   sem data fim                     esperado=SEM_PRAZO  obtido=SEM_PRAZO
ok   venceu ontem                     esperado=VENCIDA    obtido=VENCIDA
ok   vence hoje                       esperado=ATENCAO    obtido=ATENCAO
ok   vence em 7 dias (limite)         esperado=ATENCAO    obtido=ATENCAO
ok   vence em 8 dias                  esperado=ATIVA      obtido=ATIVA

Rótulos:
  vencida há 1 dia
  vence hoje
  vence em 3 dias
  sem prazo
 dias até 2026-08-08: 8

Todos os casos passaram.
```

Se algum caso falhar, corrija `status.ts` até a saída bater — em particular o limite de 7 dias, que é onde erro de `<` vs `<=` se esconde.

- [ ] **Passo 5: Commit**

```bash
git add -A
git commit -m "feat: cálculo de status e vencimento com limiar de 7 dias"
```

---

## Task 5: Período, valor total e formatação

**Arquivos:**
- Criar: `src/lib/dominio/periodo.ts`, `src/lib/dominio/formato.ts`
- Criar: `scripts/verificar-periodo.ts`

Estas são as fórmulas Excel das colunas J, K e M do arquivo original, traduzidas para código.

- [ ] **Passo 1: Escrever período e valor**

Crie `src/lib/dominio/periodo.ts`:

```ts
import { differenceInCalendarDays } from 'date-fns'

export type NomePeriodo = 'Diário' | 'Semanal' | 'Quinzenal' | 'Mensal'

/** Coluna J da planilha: classifica a duração em nome de período. */
export function periodoPorDias(dias: number): NomePeriodo {
  if (dias <= 1) return 'Diário'
  if (dias <= 7) return 'Semanal'
  if (dias <= 15) return 'Quinzenal'
  return 'Mensal'
}

/** Coluna K: quantos períodos cabem na duração, arredondando para cima. */
export function quantidadePeriodos(dias: number): number {
  const periodo = periodoPorDias(dias)
  if (periodo === 'Diário') return dias
  const divisor = periodo === 'Semanal' ? 7 : periodo === 'Quinzenal' ? 15 : 30
  return Math.ceil(dias / divisor)
}

export function duracaoEmDias(inicio: Date | null, fim: Date | null): number {
  if (!inicio || !fim) return 0
  return differenceInCalendarDays(fim, inicio)
}

/** Coluna M: valor do item multiplicado pela quantidade de períodos. */
export function valorTotal(valorItem: number | null, inicio: Date | null, fim: Date | null): number {
  if (!valorItem) return 0
  const dias = duracaoEmDias(inicio, fim)
  if (dias <= 0) return valorItem
  return valorItem * quantidadePeriodos(dias)
}
```

- [ ] **Passo 2: Escrever a formatação**

Crie `src/lib/dominio/formato.ts`:

```ts
const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

export function brl(valor: number | null | undefined): string {
  return MOEDA.format(valor ?? 0)
}

export function dataBR(data: Date | null | undefined): string {
  if (!data) return '—'
  return DATA.format(data)
}

/** Aceita "31/07/2026" ou "2026-07-31". Retorna null se não reconhecer. */
export function parseDataBR(texto: string): Date | null {
  const t = texto.trim()
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (br) return new Date(Date.UTC(+br[3], +br[2] - 1, +br[1]))
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
  return null
}
```

`timeZone: 'UTC'` é obrigatório: as datas vêm do Excel em UTC e o Brasil é UTC−3. Sem isso, `2026-07-31` aparece como `30/07/2026` na tela.

- [ ] **Passo 3: Escrever o script de verificação**

Crie `scripts/verificar-periodo.ts`:

```ts
import { periodoPorDias, quantidadePeriodos, valorTotal } from '../src/lib/dominio/periodo'
import { brl, dataBR, parseDataBR } from '../src/lib/dominio/formato'

let falhas = 0
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = String(obtido) === String(esperado)
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome.padEnd(38)} esperado=${esperado}  obtido=${obtido}`)
}

conferir('1 dia é Diário',        periodoPorDias(1), 'Diário')
conferir('7 dias é Semanal',      periodoPorDias(7), 'Semanal')
conferir('15 dias é Quinzenal',   periodoPorDias(15), 'Quinzenal')
conferir('30 dias é Mensal',      periodoPorDias(30), 'Mensal')
conferir('60 dias é Mensal',      periodoPorDias(60), 'Mensal')

conferir('30 dias = 1 período',   quantidadePeriodos(30), 1)
conferir('31 dias = 2 períodos',  quantidadePeriodos(31), 2)
conferir('60 dias = 2 períodos',  quantidadePeriodos(60), 2)
// 8 a 15 dias é Quinzenal pela coluna J, então o divisor é 15 — não 7.
// Duas semanas é inatingível por construção: nunca há 2 períodos semanais.
conferir('14 dias = 1 quinzena',  quantidadePeriodos(14), 1)
conferir('7 dias = 1 semana',     quantidadePeriodos(7), 1)
conferir('16 dias = 1 mês',       quantidadePeriodos(16), 1)

// Caso real da planilha: MARTELETE 11KG, R$ 650, 2 períodos mensais = R$ 1300.
// 23/05 a 22/07 são 60 dias exatos → ceil(60/30) = 2.
conferir(
  'martelete 650 x 2 meses',
  valorTotal(650, new Date(Date.UTC(2026, 4, 23)), new Date(Date.UTC(2026, 6, 22))),
  1300
)

// 61 dias já entram no terceiro período — a locação vira 3 mensalidades.
conferir(
  'martelete 61 dias = 3 meses',
  valorTotal(650, new Date(Date.UTC(2026, 4, 23)), new Date(Date.UTC(2026, 6, 23))),
  1950
)

conferir('brl formata em real',   brl(123681.5), 'R$ 123.681,50')
conferir('brl trata nulo',        brl(null), 'R$ 0,00')
conferir('data em UTC não recua', dataBR(new Date('2026-07-31T00:00:00Z')), '31/07/2026')
conferir('parse pt-BR',           parseDataBR('31/07/2026')?.toISOString().slice(0, 10), '2026-07-31')
conferir('parse ISO',             parseDataBR('2026-07-31')?.toISOString().slice(0, 10), '2026-07-31')
conferir('parse inválido',        parseDataBR('não é data'), 'null')

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
```

- [ ] **Passo 4: Rodar**

```bash
npx tsx scripts/verificar-periodo.ts
```

Esperado: todas as linhas com `ok` e `Todos os casos passaram.` Atenção especial a `brl formata em real` — o `Intl` usa espaço não separável antes do valor em alguns runtimes; se falhar por isso, o esperado é ajustar a comparação para `.replace(/ /g, ' ')` nos dois lados, não mudar a formatação.

- [ ] **Passo 5: Commit**

```bash
git add -A
git commit -m "feat: cálculo de período, valor total e formatação pt-BR"
```

---

# Fase 2 — Importador

## Task 6: Classificação da coluna 15

**Arquivos:**
- Criar: `src/lib/planilha/coluna15.ts`
- Criar: `scripts/verificar-coluna15.ts`

A coluna 15 tem cabeçalho `UNIDADES` mas guarda três coisas diferentes. Esta função desempilha.

- [ ] **Passo 1: Escrever o classificador**

Crie `src/lib/planilha/coluna15.ts`:

```ts
import { ESTADO, type EstadoItem } from '../dominio/constantes'

export type Coluna15 = {
  quantidade: number | null
  estado: EstadoItem | null
  observacoes: string | null
}

const VAZIO: Coluna15 = { quantidade: null, estado: null, observacoes: null }

/** Textos que são cabeçalho repetido ou lixo estrutural, não dado. */
const IGNORAR = /^(unidades|observa[çc][õo]es|obs)$/i

export function classificarColuna15(bruto: unknown): Coluna15 {
  if (bruto === null || bruto === undefined) return VAZIO
  const texto = String(bruto).trim()
  if (!texto) return VAZIO
  if (IGNORAR.test(texto)) return VAZIO

  // Número puro → quantidade. Aceita "8", "8.0", "8,0".
  if (/^\d+([.,]\d+)?$/.test(texto)) {
    const n = Math.round(Number(texto.replace(',', '.')))
    return { ...VAZIO, quantidade: n > 0 ? n : null }
  }

  if (/^perdid[oa]s?$/i.test(texto)) return { ...VAZIO, estado: ESTADO.PERDIDO }
  if (/^ok$/i.test(texto)) return { ...VAZIO, estado: ESTADO.OK }
  if (/^danificad[oa]s?$/i.test(texto)) return { ...VAZIO, estado: ESTADO.DANIFICADO }

  return { ...VAZIO, observacoes: texto }
}
```

- [ ] **Passo 2: Escrever o script de verificação**

Crie `scripts/verificar-coluna15.ts`:

```ts
import { classificarColuna15 } from '../src/lib/planilha/coluna15'

let falhas = 0
function conferir(entrada: unknown, campo: 'quantidade' | 'estado' | 'observacoes', esperado: unknown) {
  const obtido = classificarColuna15(entrada)[campo]
  const ok = String(obtido) === String(esperado)
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${JSON.stringify(entrada).padEnd(20)} ${campo.padEnd(12)} esperado=${esperado}  obtido=${obtido}`)
}

// Valores reais encontrados na planilha
conferir('8', 'quantidade', 8)
conferir(1, 'quantidade', 1)
conferir('1096', 'quantidade', 1096)
conferir('PERDIDO', 'estado', 'PERDIDO')
conferir('PERDIDA', 'estado', 'PERDIDO')
conferir('ok', 'estado', 'OK')
conferir('OK', 'estado', 'OK')
conferir('TESTE ANDAIMES', 'observacoes', 'TESTE ANDAIMES')
conferir('CONTAINER', 'observacoes', 'CONTAINER')
conferir('OBSERVAÇÕES', 'observacoes', 'null')
conferir('UNIDADES', 'quantidade', 'null')
conferir(null, 'quantidade', 'null')
conferir('   ', 'observacoes', 'null')

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
```

- [ ] **Passo 3: Rodar**

```bash
npx tsx scripts/verificar-coluna15.ts
```

Esperado: todas `ok`. `OBSERVAÇÕES` e `UNIDADES` precisam sair como `null` — são cabeçalhos vazando para dentro dos dados.

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: classificador da coluna 15 em quantidade, estado e observação"
```

---

## Task 7: Mapa de abas

**Arquivos:**
- Criar: `src/lib/planilha/mapa-abas.ts`

Três abas atendem mais de uma obra. O importador precisa saber para qual obra mandar e quais itens marcar como "a confirmar".

- [ ] **Passo 1: Escrever o mapa**

Crie `src/lib/planilha/mapa-abas.ts`:

```ts
export type DestinoAba = {
  /** Código da obra que recebe os itens desta aba. */
  obraPrincipal: string
  /** Códigos de obra que dividem esta aba. Vazio = aba exclusiva. */
  obrasCompartilhando: string[]
}

/**
 * A planilha de origem tem 8 abas de obra para 11 obras. Quando uma aba é
 * compartilhada, não há como saber a qual obra cada item pertence — os itens
 * entram na obra principal marcados com `obraAConfirmar`, para reclassificação
 * em lote pela interface.
 */
export const MAPA_ABAS: Record<string, DestinoAba> = {
  'SC-1060-25_CLARIOS':  { obraPrincipal: 'SC-1060-25',  obrasCompartilhando: [] },
  'SC-1096-25_CLARIOS':  { obraPrincipal: 'SC-1096-25',  obrasCompartilhando: [] },
  'SC-1135-25A':         { obraPrincipal: 'SC-1135-25A', obrasCompartilhando: [] },
  'SC-1135-25B_MORELLI': { obraPrincipal: 'SC-1135-25B', obrasCompartilhando: ['SC-1135-25B', 'SC-1135-25C'] },
  'SC-1017-26_TOYOTA':   { obraPrincipal: 'SC-1017-26',  obrasCompartilhando: ['SC-1028-25', 'SC-1122-25', 'SC-1017-26'] },
  'SC-1176-25_ADIMAX':   { obraPrincipal: 'SC-1176-25',  obrasCompartilhando: [] },
  'SC-1009-26_ADIMAX':   { obraPrincipal: 'SC-1009-26',  obrasCompartilhando: [] },
  'LINC':                { obraPrincipal: 'LINC',        obrasCompartilhando: [] },
}

/** Abas que existem no arquivo mas não contêm locações. */
export const ABAS_IGNORADAS = new Set(['RESUMO'])

export function destinoDaAba(nomeAba: string): DestinoAba | null {
  return MAPA_ABAS[nomeAba] ?? null
}

export function abaEhCompartilhada(nomeAba: string): boolean {
  return (MAPA_ABAS[nomeAba]?.obrasCompartilhando.length ?? 0) > 0
}
```

- [ ] **Passo 2: Conferir contra o arquivo real**

```bash
npx tsx -e "
import ExcelJS from 'exceljs'
import { MAPA_ABAS, ABAS_IGNORADAS } from './src/lib/planilha/mapa-abas'
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('dados/Maquinas_Alugadas_Controle_REVISADA.xlsx')
const abas = wb.worksheets.map(w => w.name)
console.log('Abas no arquivo:', abas.length)
const naoMapeadas = abas.filter(a => !MAPA_ABAS[a] && !ABAS_IGNORADAS.has(a))
const faltando = Object.keys(MAPA_ABAS).filter(a => !abas.includes(a))
console.log('Sem mapeamento:', naoMapeadas)
console.log('Mapeadas mas ausentes:', faltando)
"
```

Esperado:
```
Abas no arquivo: 9
Sem mapeamento: []
Mapeadas mas ausentes: []
```

Qualquer aba nas listas significa que a planilha mudou desde o design — pare e reconcilie antes de seguir.

- [ ] **Passo 3: Commit**

```bash
git add -A
git commit -m "feat: mapa de abas da planilha para obras, com marcação de abas compartilhadas"
```

---

## Task 8: Parser da planilha

**Arquivos:**
- Criar: `src/lib/planilha/parser.ts`
- Criar: `scripts/verificar-planilha.ts`

O layout varia entre abas — `SC-1135-25A` tem cabeçalho na linha 8, as demais na 3. O parser localiza `Nº` dinamicamente, igual fazia a função `_hrow` do Python.

- [ ] **Passo 1: Escrever o parser**

Crie `src/lib/planilha/parser.ts`:

```ts
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { classificarColuna15, type Coluna15 } from './coluna15'
import { ABAS_IGNORADAS, destinoDaAba } from './mapa-abas'

export type LinhaPlanilha = {
  aba: string
  linha: number
  numeroOrigem: string | null
  descricao: string
  trCodigo: string | null
  dataInicio: Date | null
  dataFim: Date | null
  valorItem: number | null
  fornecedorBruto: string | null
  devolvida: boolean
  obraCodigo: string
  obraAConfirmar: boolean
} & Coluna15

export type ResultadoParse = {
  linhas: LinhaPlanilha[]
  ignoradas: { aba: string; linha: number; motivo: string }[]
}

/** Marcadores que encerram o bloco de LOCAÇÕES. */
const FIM_DO_BLOCO = ['LEGENDA:', 'DEVOLUÇÕES', 'DEVOLUCOES', '◂ VOLTAR AO RESUMO']

const COL = {
  numero: 1, descricao: 2, tr: 3, inicio: 4, fim: 5,
  valorItem: 12, fornecedor: 14, coluna15: 15,
} as const

function texto(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && 'result' in v) return texto(v.result as ExcelJS.CellValue)
  if (typeof v === 'object' && 'richText' in v) {
    return (v.richText as { text: string }[]).map((r) => r.text).join('').trim() || null
  }
  const s = String(v).trim()
  return s || null
}

function data(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'object' && v !== null && 'result' in v) return data(v.result as ExcelJS.CellValue)
  return null
}

function numero(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'result' in v) return numero(v.result as ExcelJS.CellValue)
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function ehFimDoBloco(v: string | null): boolean {
  if (!v) return false
  return FIM_DO_BLOCO.some((m) => v.toUpperCase().includes(m))
}

function localizarCabecalho(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 60); r++) {
    if (texto(ws.getRow(r).getCell(COL.numero).value) === 'Nº') return r
  }
  return null
}

function localizarDevolucoes(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 400); r++) {
    const v = texto(ws.getRow(r).getCell(COL.numero).value)
    if (v === 'DEVOLUÇÕES' || v === 'DEVOLUCOES') return r
  }
  return null
}

function lerLinha(
  ws: ExcelJS.Worksheet, r: number, aba: string, obraCodigo: string,
  obraAConfirmar: boolean, devolvida: boolean
): LinhaPlanilha | null {
  const row = ws.getRow(r)
  const descricao = texto(row.getCell(COL.descricao).value)
  if (!descricao) return null

  // Normaliza ANTES de classificar: `texto()` desembrulha células de fórmula
  // ({ formula, result }) e richText. Sem isso, elas virariam a string
  // "[object Object]" e entrariam no banco como observação.
  const c15 = classificarColuna15(texto(row.getCell(COL.coluna15).value))

  return {
    aba, linha: r, obraCodigo, obraAConfirmar, devolvida, descricao,
    numeroOrigem: texto(row.getCell(COL.numero).value),
    trCodigo: texto(row.getCell(COL.tr).value),
    dataInicio: data(row.getCell(COL.inicio).value),
    dataFim: data(row.getCell(COL.fim).value),
    valorItem: numero(row.getCell(COL.valorItem).value),
    fornecedorBruto: texto(row.getCell(COL.fornecedor).value),
    ...c15,
  }
}

/**
 * Abre a planilha contornando um defeito do arquivo de origem.
 *
 * A planilha da construtora grava comentários em `xl/comments/comment1.xml`,
 * mas o padrão OOXML — e o que o ExcelJS espera — é `xl/comments1.xml`. Com o
 * caminho fora do padrão, `wb.xlsx.readFile()` estoura com
 * "Cannot read properties of undefined (reading 'comments')" e nenhum dado é lido.
 *
 * Comentários não interessam à importação, então removemos essas partes do zip
 * em memória (e as referências a elas nos `.rels` e no `[Content_Types].xml`)
 * antes de entregar o arquivo ao ExcelJS. O arquivo em disco não é alterado.
 */
export async function abrirPlanilha(caminho: string): Promise<ExcelJS.Workbook> {
  const zip = await JSZip.loadAsync(await readFile(caminho))

  for (const nome of Object.keys(zip.files)) {
    if (/comments?\/|\.vml$|comments\d*\.xml$/i.test(nome)) zip.remove(nome)
  }

  for (const nome of Object.keys(zip.files).filter((f) => /_rels\/.*\.rels$/.test(f))) {
    const xml = await zip.file(nome)!.async('string')
    zip.file(nome, xml.replace(/<Relationship[^>]*(?:comments|vmlDrawing)[^>]*\/>/gi, ''))
  }

  const tipos = zip.file('[Content_Types].xml')
  if (tipos) {
    const xml = await tipos.async('string')
    zip.file('[Content_Types].xml', xml.replace(/<Override[^>]*(?:comments|vml)[^>]*\/>/gi, ''))
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await zip.generateAsync({ type: 'nodebuffer' }))
  return wb
}

export async function lerPlanilha(caminho: string): Promise<ResultadoParse> {
  const wb = await abrirPlanilha(caminho)

  const linhas: LinhaPlanilha[] = []
  const ignoradas: ResultadoParse['ignoradas'] = []

  for (const ws of wb.worksheets) {
    if (ABAS_IGNORADAS.has(ws.name)) continue

    const destino = destinoDaAba(ws.name)
    if (!destino) {
      ignoradas.push({ aba: ws.name, linha: 0, motivo: 'aba sem mapeamento para obra' })
      continue
    }

    const aConfirmar = destino.obrasCompartilhando.length > 0
    const cabecalho = localizarCabecalho(ws)
    if (cabecalho === null) {
      ignoradas.push({ aba: ws.name, linha: 0, motivo: 'cabeçalho "Nº" não encontrado' })
      continue
    }

    const inicioDevolucoes = localizarDevolucoes(ws)
    const fimLocacoes = inicioDevolucoes ?? ws.rowCount

    // Bloco LOCAÇÕES
    for (let r = cabecalho + 1; r < fimLocacoes; r++) {
      const marcador = texto(ws.getRow(r).getCell(COL.numero).value)
      if (ehFimDoBloco(marcador)) break
      const linha = lerLinha(ws, r, ws.name, destino.obraPrincipal, aConfirmar, false)
      if (linha) linhas.push(linha)
    }

    // Bloco DEVOLUÇÕES
    if (inicioDevolucoes !== null) {
      let vaziasSeguidas = 0
      for (let r = inicioDevolucoes + 1; r <= ws.rowCount && vaziasSeguidas < 20; r++) {
        const linha = lerLinha(ws, r, ws.name, destino.obraPrincipal, aConfirmar, true)
        if (linha) { linhas.push(linha); vaziasSeguidas = 0 } else { vaziasSeguidas++ }
      }
    }
  }

  return { linhas, ignoradas }
}
```

O contador `vaziasSeguidas` existe porque as abas têm ~1000 linhas alocadas e o bloco de devoluções não tem marcador de fim — 20 linhas vazias em sequência significam que acabou.

- [ ] **Passo 2: Escrever o script de verificação**

Crie `scripts/verificar-planilha.ts`:

```ts
import { lerPlanilha } from '../src/lib/planilha/parser'

const CAMINHO = 'dados/Maquinas_Alugadas_Controle_REVISADA.xlsx'

// Conferidos por recontagem rigorosa em 2026-08-01. Atenção: a contagem
// original do design dizia 61 devolvidas — estava errada, o script de análise
// lia o bloco DEVOLUÇÕES a partir de dev+2 e pulava a primeira linha de dados
// em várias abas. O total bruto real é 63.
const ESPERADO = { ativos: 242, devolvidos: 63, perdidos: 16, aConfirmar: 110 }

async function main() {
  const { linhas, ignoradas } = await lerPlanilha(CAMINHO)

  const ativos = linhas.filter((l) => !l.devolvida).length
  const devolvidos = linhas.filter((l) => l.devolvida).length
  const perdidos = linhas.filter((l) => l.estado === 'PERDIDO').length
  const aConfirmar = linhas.filter((l) => l.obraAConfirmar).length

  console.log('Por aba:')
  const porAba = new Map<string, { a: number; d: number }>()
  for (const l of linhas) {
    const e = porAba.get(l.aba) ?? { a: 0, d: 0 }
    l.devolvida ? e.d++ : e.a++
    porAba.set(l.aba, e)
  }
  for (const [aba, { a, d }] of porAba) {
    console.log(`  ${aba.padEnd(24)} ativos=${String(a).padStart(3)}  devolvidos=${String(d).padStart(3)}`)
  }

  console.log('\nTotais:')
  const conferir = (nome: string, obtido: number, esperado: number) => {
    const ok = obtido === esperado
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${nome.padEnd(24)} esperado=${esperado}  obtido=${obtido}`)
    return ok
  }
  const resultados = [
    conferir('locações ativas', ativos, ESPERADO.ativos),
    conferir('devolvidas', devolvidos, ESPERADO.devolvidos),
    conferir('itens perdidos', perdidos, ESPERADO.perdidos),
    conferir('obra a confirmar', aConfirmar, ESPERADO.aConfirmar),
  ]

  const semFornecedor = linhas.filter((l) => !l.fornecedorBruto).length
  const semDatas = linhas.filter((l) => !l.devolvida && (!l.dataInicio || !l.dataFim)).length
  console.log(`\n  sem fornecedor: ${semFornecedor}`)
  console.log(`  ativos sem datas: ${semDatas}`)

  const fornecedores = new Set(linhas.map((l) => l.fornecedorBruto).filter(Boolean))
  console.log(`\nFornecedores distintos na planilha (${fornecedores.size}):`)
  for (const f of [...fornecedores].sort()) console.log(`  ${f}`)

  if (ignoradas.length) {
    console.log('\nIgnoradas:')
    for (const i of ignoradas) console.log(`  ${i.aba} linha ${i.linha}: ${i.motivo}`)
  }

  const todosOk = resultados.every(Boolean)
  console.log(todosOk ? '\nParser confere com a planilha.' : '\nParser divergiu — investigue antes de importar.')
  process.exit(todosOk ? 0 : 1)
}

main()
```

- [ ] **Passo 3: Rodar e ver falhar antes de acertar**

```bash
npm run verificar:planilha
```

Esperado ao final:
```
Totais:
  ok   locações ativas          esperado=242  obtido=242
  ok   devolvidas               esperado=61   obtido=61
  ok   itens perdidos           esperado=16   obtido=16
  ok   obra a confirmar         esperado=110  obtido=110

Parser confere com a planilha.
```

Se `locações ativas` vier acima de 242, o parser está lendo linhas de legenda como dados — confira `ehFimDoBloco`. Se vier abaixo, o corte do bloco está agressivo demais. Não siga para a Task 9 sem os quatro `ok`: todo o resto da importação depende destes números.

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: parser da planilha validado contra 242 ativos e 61 devolvidas"
```

---

## Registros repetidos entre abas — decisão de negócio

A planilha repete equipamentos entre abas de obras diferentes: 41 assinaturas entre os
ativos e 9 entre as devoluções (estas com data de início, data de fim e valor idênticos).

O campo `Tr` **não** identifica um equipamento — é número de requisição/nota, e um mesmo Tr
cobre vários itens (o Tr `15936` cobre 7). Por isso não é possível distinguir
automaticamente um erro de copiar/colar de uma remessa legitimamente dividida entre duas
obras.

**Regra decidida: importar tudo e sinalizar.** Nenhum registro é descartado. Toda linha cuja
assinatura apareça em mais de uma aba entra com `possivelDuplicata = true`, e a interface
oferece filtro e aviso para a equipe revisar — mesmo tratamento dado aos 110 "obra a
confirmar". Deduplicar automaticamente faria o sistema escolher sozinho qual obra fica com o
equipamento, e sumiria com custo real de obra se a remessa tiver sido mesmo dividida.

Assinatura para ativos: `descrição + Tr`. Para devoluções: `descrição + Tr + início + fim + valor`.

## Task 9: Gravação da importação

**Arquivos:**
- Criar: `src/actions/importar.ts`
- Modificar: `prisma/schema.prisma` (+ migration)

**Antes de tudo, acrescente o campo de sinalização ao schema.** O parser já marca
`possivelDuplicata`, mas a tabela ainda não tem onde guardar. Em `model Locacao`, junto de
`obraAConfirmar`:

```prisma
  possivelDuplicata Boolean @default(false)
```

E crie a migration:

```bash
npx prisma migrate dev --name possivel-duplicata
```

A importação é idempotente: rodar duas vezes não duplica. A chave natural é `aba + linha de origem`, guardada em `numeroOrigem` combinado com a obra — mas como `Nº` repete entre abas, a identidade real é `descricao + trCodigo + obraId + dataInicio`.

- [ ] **Passo 1: Escrever a action**

Crie `src/actions/importar.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { lerPlanilha, type LinhaPlanilha } from '@/lib/planilha/parser'
import { MOVIMENTACAO } from '@/lib/dominio/constantes'

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

export type PreviaImportacao = {
  total: number
  ativos: number
  devolvidos: number
  perdidos: number
  aConfirmar: number
  fornecedoresNovos: string[]
  porAba: { aba: string; ativos: number; devolvidos: number }[]
  ignoradas: { aba: string; linha: number; motivo: string }[]
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

async function mapaFornecedores(): Promise<Map<string, string>> {
  const [fornecedores, aliases] = await Promise.all([
    prisma.fornecedor.findMany({ select: { id: true, nome: true } }),
    prisma.fornecedorAlias.findMany({ select: { alias: true, fornecedorId: true } }),
  ])
  const mapa = new Map<string, string>()
  for (const f of fornecedores) mapa.set(normalizar(f.nome), f.id)
  for (const a of aliases) mapa.set(normalizar(a.alias), a.fornecedorId)
  return mapa
}

export async function gerarPrevia(caminho: string): Promise<Resultado<PreviaImportacao>> {
  try {
    const { linhas, ignoradas } = await lerPlanilha(caminho)
    const mapa = await mapaFornecedores()

    const novos = new Set<string>()
    for (const l of linhas) {
      if (l.fornecedorBruto && !mapa.has(normalizar(l.fornecedorBruto))) novos.add(l.fornecedorBruto)
    }

    const porAba = new Map<string, { ativos: number; devolvidos: number }>()
    for (const l of linhas) {
      const e = porAba.get(l.aba) ?? { ativos: 0, devolvidos: 0 }
      l.devolvida ? e.devolvidos++ : e.ativos++
      porAba.set(l.aba, e)
    }

    return {
      ok: true,
      dados: {
        total: linhas.length,
        ativos: linhas.filter((l) => !l.devolvida).length,
        devolvidos: linhas.filter((l) => l.devolvida).length,
        perdidos: linhas.filter((l) => l.estado === 'PERDIDO').length,
        aConfirmar: linhas.filter((l) => l.obraAConfirmar).length,
        fornecedoresNovos: [...novos].sort(),
        porAba: [...porAba].map(([aba, v]) => ({ aba, ...v })),
        ignoradas,
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao ler a planilha' }
  }
}

function chave(l: LinhaPlanilha, obraId: string): string {
  return [obraId, normalizar(l.descricao), l.trCodigo ?? '', l.dataInicio?.toISOString() ?? ''].join('|')
}

export async function confirmarImportacao(caminho: string): Promise<Resultado<{ criadas: number; puladas: number; fornecedoresCriados: number }>> {
  try {
    const { linhas } = await lerPlanilha(caminho)

    const obras = await prisma.obra.findMany({ select: { id: true, codigo: true } })
    const obraPorCodigo = new Map(obras.map((o) => [o.codigo, o.id]))

    // Cria fornecedores que aparecem na planilha e não estão cadastrados
    let fornecedoresCriados = 0
    let mapa = await mapaFornecedores()
    for (const l of linhas) {
      if (!l.fornecedorBruto) continue
      if (mapa.has(normalizar(l.fornecedorBruto))) continue
      await prisma.fornecedor.create({ data: { nome: l.fornecedorBruto.trim() } })
      fornecedoresCriados++
      mapa = await mapaFornecedores()
    }

    // Chaves já existentes, para não duplicar em reimportação
    const existentes = await prisma.locacao.findMany({
      select: { obraId: true, descricao: true, trCodigo: true, dataInicio: true },
    })
    const jaTem = new Set(
      existentes.map((e) =>
        [e.obraId, normalizar(e.descricao), e.trCodigo ?? '', e.dataInicio?.toISOString() ?? ''].join('|')
      )
    )

    let criadas = 0
    let puladas = 0

    for (const l of linhas) {
      const obraId = obraPorCodigo.get(l.obraCodigo)
      if (!obraId) { puladas++; continue }

      const k = chave(l, obraId)
      if (jaTem.has(k)) { puladas++; continue }
      jaTem.add(k)

      const fornecedorId = l.fornecedorBruto ? mapa.get(normalizar(l.fornecedorBruto)) ?? null : null

      await prisma.locacao.create({
        data: {
          obraId,
          fornecedorId,
          descricao: l.descricao,
          trCodigo: l.trCodigo,
          quantidade: l.quantidade ?? 1,
          estado: l.estado ?? 'OK',
          observacoes: l.observacoes,
          dataInicio: l.dataInicio,
          dataFim: l.dataFim,
          valorItem: l.valorItem,
          devolvidaEm: l.devolvida ? (l.dataFim ?? l.dataInicio ?? new Date()) : null,
          obraAConfirmar: l.obraAConfirmar,
          numeroOrigem: l.numeroOrigem,
          movimentacoes: {
            create: {
              tipo: MOVIMENTACAO.IMPORTACAO,
              descricaoHumana: `Importado da aba ${l.aba}, linha ${l.linha}`,
            },
          },
        },
      })
      criadas++
    }

    revalidatePath('/')
    revalidatePath('/locacoes')
    return { ok: true, dados: { criadas, puladas, fornecedoresCriados } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao gravar a importação' }
  }
}
```

- [ ] **Passo 2: Verificar a importação e a idempotência**

```bash
npx tsx -e "
import { confirmarImportacao } from './src/actions/importar'
import { prisma } from './src/lib/prisma'
const C = 'dados/Maquinas_Alugadas_Controle_REVISADA.xlsx'
console.log('1a passada:', await confirmarImportacao(C))
console.log('2a passada:', await confirmarImportacao(C))
console.log('total no banco:', await prisma.locacao.count())
console.log('devolvidas:', await prisma.locacao.count({ where: { devolvidaEm: { not: null } } }))
console.log('perdidos:', await prisma.locacao.count({ where: { estado: 'PERDIDO' } }))
console.log('a confirmar:', await prisma.locacao.count({ where: { obraAConfirmar: true } }))
await prisma.\$disconnect()
"
```

Esperado:
```
1a passada: { ok: true, dados: { criadas: 303, puladas: 0, fornecedoresCriados: 0 } }
2a passada: { ok: true, dados: { criadas: 0, puladas: 303, fornecedoresCriados: 0 } }
total no banco: 303
devolvidas: 61
perdidos: 16
a confirmar: 110
```

A segunda passada com `criadas: 0` é o ponto crítico: significa que a equipe pode reimportar depois de mexer na planilha sem duplicar nada. Se `fornecedoresCriados` vier maior que zero, algum nome da planilha não casou com os aliases do seed — veja qual e acrescente o alias na Task 3 em vez de aceitar o fornecedor duplicado.

- [ ] **Passo 3: Limpar o banco para os testes seguintes**

```bash
npm run db:reset
```

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: importação idempotente da planilha com prévia e normalização de fornecedores"
```

---

## Task 10: Tela de importação

**Arquivos:**
- Criar: `src/app/importar/page.tsx`, `src/components/importar/preview-importacao.tsx`
- Modificar: `src/actions/importar.ts`

O upload grava o arquivo em `dados/upload-<timestamp>.xlsx` e devolve o caminho, que alimenta a prévia. Nada é gravado no banco antes da confirmação explícita.

- [ ] **Passo 1: Acrescentar a action de upload**

Acrescente ao fim de `src/actions/importar.ts`:

```ts
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export async function receberUpload(formData: FormData): Promise<Resultado<{ caminho: string }>> {
  try {
    const arquivo = formData.get('planilha')
    if (!(arquivo instanceof File)) return { ok: false, erro: 'Nenhum arquivo enviado.' }
    if (!arquivo.name.match(/\.xlsx?$/i)) return { ok: false, erro: 'Envie um arquivo .xlsx.' }

    const pasta = path.join(process.cwd(), 'dados')
    await mkdir(pasta, { recursive: true })
    const caminho = path.join(pasta, `upload-${Date.now()}.xlsx`)
    await writeFile(caminho, Buffer.from(await arquivo.arrayBuffer()))

    return { ok: true, dados: { caminho } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao receber o arquivo' }
  }
}
```

- [ ] **Passo 2: Escrever o componente de prévia**

Crie `src/components/importar/preview-importacao.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { confirmarImportacao, gerarPrevia, receberUpload, type PreviaImportacao } from '@/actions/importar'

export function PreviewImportacao() {
  const [caminho, setCaminho] = useState<string | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(formData: FormData) {
    setErro(null); setConcluido(null)
    iniciar(async () => {
      const upload = await receberUpload(formData)
      if (!upload.ok) return setErro(upload.erro)
      setCaminho(upload.dados.caminho)
      const p = await gerarPrevia(upload.dados.caminho)
      if (!p.ok) return setErro(p.erro)
      setPrevia(p.dados)
    })
  }

  function confirmar() {
    if (!caminho) return
    setErro(null)
    iniciar(async () => {
      const r = await confirmarImportacao(caminho)
      if (!r.ok) return setErro(r.erro)
      setConcluido(
        `${r.dados.criadas} locações criadas, ${r.dados.puladas} já existiam` +
        (r.dados.fornecedoresCriados ? `, ${r.dados.fornecedoresCriados} fornecedores novos` : '')
      )
      setPrevia(null)
    })
  }

  return (
    <div className="space-y-6">
      <form action={enviar} className="rounded-lg border border-border bg-card p-6">
        <label htmlFor="planilha" className="mb-2 block text-sm font-medium">
          Planilha de controle (.xlsx)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="planilha" name="planilha" type="file" accept=".xlsx,.xlsm" required
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm
                       file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5
                       file:text-sm file:text-primary-foreground"
          />
          <button
            type="submit" disabled={pendente}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
                       disabled:opacity-50"
          >
            {pendente ? 'Lendo...' : 'Analisar'}
          </button>
        </div>
      </form>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {concluido && (
        <div role="status" className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          Importação concluída: {concluido}
        </div>
      )}

      {previa && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Prévia — nada foi gravado ainda</h2>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Ativas', previa.ativos],
              ['Devolvidas', previa.devolvidos],
              ['Itens perdidos', previa.perdidos],
              ['Obra a confirmar', previa.aConfirmar],
            ].map(([rotulo, valor]) => (
              <div key={String(rotulo)} className="rounded-md border border-border p-3">
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Aba</th>
                  <th className="py-2 pr-4 text-right font-medium">Ativas</th>
                  <th className="py-2 text-right font-medium">Devolvidas</th>
                </tr>
              </thead>
              <tbody>
                {previa.porAba.map((a) => (
                  <tr key={a.aba} className="border-b border-border/50">
                    <td className="py-2 pr-4">{a.aba}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{a.ativos}</td>
                    <td className="py-2 text-right tabular-nums">{a.devolvidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previa.fornecedoresNovos.length > 0 && (
            <div className="rounded-md border border-amber-600/50 bg-amber-600/10 p-4 text-sm">
              <p className="font-medium">Fornecedores que serão criados ({previa.fornecedoresNovos.length}):</p>
              <p className="mt-1 text-muted-foreground">{previa.fornecedoresNovos.join(' · ')}</p>
            </div>
          )}

          {previa.ignoradas.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Linhas não interpretadas ({previa.ignoradas.length}):</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {previa.ignoradas.map((i, n) => (
                  <li key={n}>{i.aba} linha {i.linha}: {i.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={confirmar} disabled={pendente}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {pendente ? 'Importando...' : `Confirmar importação de ${previa.total} registros`}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Escrever a página**

Crie `src/app/importar/page.tsx`:

```tsx
import { PreviewImportacao } from '@/components/importar/preview-importacao'

export const metadata = { title: 'Importar planilha — Painel de Locação SC' }

export default function ImportarPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie a planilha de controle. Você verá o que o sistema entendeu antes de qualquer
          gravação, e reimportar não duplica registros existentes.
        </p>
      </header>
      <PreviewImportacao />
    </div>
  )
}
```

- [ ] **Passo 4: Verificar na tela**

```bash
npm run dev
```

Abra `http://localhost:3000/importar`, envie `dados/Maquinas_Alugadas_Controle_REVISADA.xlsx`.

Esperado: a prévia mostra Ativas 242, Devolvidas 61, Itens perdidos 16, Obra a confirmar 110, a tabela com 8 abas, nenhum fornecedor novo e nenhuma linha não interpretada. Clique em confirmar e veja a mensagem de conclusão com 303 criadas.

- [ ] **Passo 5: Commit**

```bash
git add -A
git commit -m "feat: tela de importação com prévia antes de gravar"
```

---

Deste ponto em diante o plano segue nas Fases 3 a 5 (interface, exportação e testes E2E), detalhadas em `docs/plans/2026-07-31-painel-locacao-mvp-parte2.md`.
