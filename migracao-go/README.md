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
| **Portal** (`/` ou `/portal`) | ✅ [`portal/COMPORTAMENTO.md`](portal/COMPORTAMENTO.md) | ✅ `apps/portal/e2e/` — 20/20 passando contra o Next.js atual (2026-08-04) | ⬜ não iniciado | ⬜ |
| Painel de Locação (`/painel`) | ⬜ | ⬜ | ⬜ | ⬜ |
| RH e SST (`/rh`) | ⬜ | ⬜ | ⬜ | ⬜ |
| Almoxarifado (`/almoxarifado`) | ⬜ | ⬜ | ⬜ | ⬜ |
| Alojamentos (`/alojamentos`) | ⬜ | ⬜ | ⬜ | ⬜ |

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
