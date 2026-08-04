# Migração para Go + Templ + SQLite

Reescrita de 5 apps hoje separados (`apps/portal`, `apps/painel-locacao`, `apps/rh`,
`apps/estoque`, `apps/alojamentos` — Next.js 16 + React 19 + Prisma + Tailwind, cada um com
seu próprio processo, porta e banco SQLite) para **um único binário Go**, servindo tudo numa
porta só, com **um único banco SQLite**. Go + Templ + HTML/CSS + `database/sql`/`sqlc` (sem
ORM pesado), JS mínimo (HTMX só onde necessário), Redis só se realmente necessário.
`apps/frota` (Next.js + Drizzle, banco próprio) fica fora deste escopo por enquanto — decisão
de 2026-08-04, revisitável depois.

Requisitos do processo, definidos pelo usuário — não são sugestões, são o critério de
aceitação de cada etapa:

- **Incremental, nunca tudo de uma vez** (Strangler Fig). Com o destino sendo um binário só,
  isto significa: o Go cresce módulo por módulo *dentro do mesmo processo*, cada módulo
  passando a responder num prefixo de rota (`/painel`, `/rh`, `/almoxarifado`,
  `/alojamentos`, `/` ou `/portal` pra identidade), enquanto os módulos ainda não migrados
  continuam nos processos Next.js separados de sempre, em portas diferentes. Nenhum módulo
  Next.js é desligado antes de o equivalente em Go passar na suíte de referência dele.
- **TDD obrigatório** por módulo: mapear comportamento atual → escrever testes que o
  representem → (falham, pois o Go ainda não existe) → implementar em Go → testes passam →
  só então remover o código Next.js daquele módulo.
- **Nenhuma funcionalidade removida sem justificativa técnica explícita.**
- Arquitetura Clean/Hexagonal (Ports and Adapters) — domínio nunca importa SQLite, tudo passa
  por interfaces de repositório. Estrutura de pastas, configuração de produção do SQLite
  (WAL, foreign_keys, prepared statements etc.) e critério de teste por camada estão em
  **[`ARQUITETURA.md`](ARQUITETURA.md)** — leitura obrigatória antes de escrever o primeiro
  pacote Go.

## Por que o Portal primeiro

Continua sendo o ponto de entrada — quem visita `/` ou `/portal` loga e vê o hub. A diferença
pro plano anterior (revisado em 2026-08-04): como tudo vai virar o mesmo processo, o "login
único entre apps" que hoje depende de um `AUTH_SECRET` compartilhado entre 5 processos Next.js
deixa de ser necessário assim que um módulo migra — dentro do binário Go, sessão é sessão do
processo único, sem token cruzando fronteira de serviço. **Enquanto o Portal em Go convive com
os 4 apps Next.js ainda não migrados**, porém, ele continua precisando emitir um cookie que os
Next.js restantes conseguem validar — ou seja, a etapa de transição do Portal ainda exige
compatibilidade com o mecanismo documentado em [`portal/COMPORTAMENTO.md`](portal/COMPORTAMENTO.md)
§2. Essa compatibilidade só pode ser relaxada depois que o **último** dos 4 apps Next.js for
desligado.

## Banco único — decisão tomada em 2026-08-04

Confirmado pelo usuário: **um SQLite só**, bem modelado — nada de banco por módulo. A
duplicação encontrada ao mapear os 4 schemas restantes (`Obra` existe em Painel, RH,
Almoxarifado e Alojamentos, mesmo formato central, hoje sem relação real entre si — só
correlacionadas por convenção de código `EX-1001-25`; `Fornecedor` se repete entre Painel e
Almoxarifado) **vai ser unificada em tabelas compartilhadas com FK**, não mantida separada por
domínio. Detalhe de execução em `ARQUITETURA.md` §2. O desenho de schema exato (nomes de
coluna, o campo de geocodificação que só Alojamentos tem) fica pra quando a migração chegar no
segundo módulo — o Portal não tem `Obra`.

## Status por módulo

| Módulo | Comportamento mapeado | Testes de referência | Implementação Go | Next.js removido |
|---|---|---|---|---|
| **Portal** (`/` ou `/portal`) | ✅ [`portal/COMPORTAMENTO.md`](portal/COMPORTAMENTO.md) | ✅ `apps/portal/e2e/` — 20/20 contra o Next.js **e** contra o Go (`playwright.go.config.ts`) | ✅ `cmd/servidor`, `cmd/seed` — login, usuários, hub (2026-08-04) | ⬜ ainda convivendo — 4 apps Next.js seguem no ar |
| **Painel de Locação** (`/painel`) | ✅ [`painel/COMPORTAMENTO.md`](painel/COMPORTAMENTO.md) | ✅ `apps/painel-locacao/e2e/*.go.spec.ts` — 18/18, duas vezes seguidas | ✅ CRUD/ciclo de vida completo + importador Excel (validado byte-exato contra a planilha real: 305/242/63/16/90/20) + exportadores Excel/PDF (2026-08-04) | ⬜ ainda convivendo |
| RH e SST (`/rh`) | ⬜ | ⬜ | ⬜ | ⬜ |
| Almoxarifado (`/almoxarifado`) | ⬜ | ⬜ | ⬜ | ⬜ |
| Alojamentos (`/alojamentos`) | ⬜ | ⬜ | ⬜ | ⬜ |

## Painel de Locação — adaptações conscientes (2026-08-04)

A suíte de testes do Painel é NOVA (`*.go.spec.ts`), não uma cópia dos `.spec.ts` originais —
mesmo motivo do Portal (COMPORTAMENTO.md documenta comportamento de negócio, não a árvore DOM
exata). Três divergências deliberadas do Next.js, registradas para não serem confundidas com
lacuna não percebida:

- **Sem drawer/dialogs/tabs.** A interação vira navegação servidor-renderizada de verdade:
  clicar numa locação abre uma página de detalhe própria (`/painel/locacoes/{id}`), e
  Renovar/Transferir/Devolver são formulários `<details>` expansíveis na mesma página, não
  modais. Histórico fica sempre visível, não atrás de aba. Zero JavaScript de estado — só uma
  concessão pontual (recalcular "Fim" a partir de "Início" + período no formulário de nova
  locação), justificada por evitar uma volta ao servidor pra uma soma de dias.
- **Layout responsivo único**, não dois DOMs paralelos (tabela desktop + cards mobile) como o
  Next.js. `e2e/responsivo.spec.ts` (275 linhas, testa especificamente essa dualidade) não foi
  portado — o comportamento que ele protegia (nenhuma coluna estoura em 390px) não se aplica
  à mesma forma nesta implementação.
- **`aConfirmar` não é conferido byte-a-byte** no teste de importação: esse número depende de
  quais obras compartilham aba no `dados-locais.json` real da empresa (privado, fora do
  repo — nem o Next.js consegue reproduzi-lo sem ele). Os outros 5 números (305/242/63/16/
  90+20) **batem exatamente**, provando que o parser está correto; `aConfirmar` fica 0 no
  teste porque ele usa um mapeamento 1:1 aba→obra próprio, sem nenhuma aba compartilhada.

## Como os testes de referência funcionam

Cada módulo ganha uma suíte Playwright em `apps/<módulo>/e2e/` que descreve o comportamento
observável **do app Next.js atual** — não é teste unitário de implementação, é teste de
comportamento de fora pra dentro (rota, formulário, resposta HTTP, cookie). Essa suíte:

1. hoje, roda contra o Next.js daquele módulo e serve de linha de base;
2. quando o Go do módulo nascer dentro do binário único, a mesma suíte (ajustando só a
   `baseURL` pro prefixo novo, ex. `http://localhost:PORTA/painel`) deve passar **sem editar
   os testes** — é a prova de equivalência funcional que o processo exige antes de desligar o
   Next.js daquele módulo.

Ver `apps/portal/e2e/` para o primeiro exemplo.
