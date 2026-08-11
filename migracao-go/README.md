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

## Importação do cadastro operacional da Programação

Listas tabuladas com as seções `FUNCIONÁRIOS` e `Veiculo` podem ser carregadas de forma
idempotente no banco do servidor. O comando cria funções por sigla, atualiza pessoas pelo nome
normalizado e atualiza veículos pela placa (ou pelo modelo quando a placa estiver ausente):

```powershell
$env:DATABASE_PATH = 'servidor.db'
go run ./cmd/importar-programacao 'caminho\lista.txt'
```

Esse cadastro é operacional e não substitui o RH: sem CPF, matrícula e dados admissionais, a
pessoa não pode ser criada como funcionário formal.

## Status por módulo

| Módulo | Comportamento mapeado | Testes de referência | Implementação Go | Next.js removido |
|---|---|---|---|---|
| **Portal** (`/` ou `/portal`) | ✅ [`portal/COMPORTAMENTO.md`](portal/COMPORTAMENTO.md) | ✅ `apps/portal/e2e/` — 20/20 contra o Next.js **e** contra o Go (`playwright.go.config.ts`) | ✅ `cmd/servidor`, `cmd/seed` — login, usuários, hub (2026-08-04) | ⬜ ainda convivendo — 4 apps Next.js seguem no ar |
| **Painel de Locação** (`/painel`) | ✅ [`painel/COMPORTAMENTO.md`](painel/COMPORTAMENTO.md) | ✅ `apps/painel-locacao/e2e/*.go.spec.ts` — 18/18, duas vezes seguidas | ✅ CRUD/ciclo de vida completo + importador Excel (validado byte-exato contra a planilha real: 305/242/63/16/90/20) + exportadores Excel/PDF (2026-08-04) | ⬜ ainda convivendo |
| **Almoxarifado** (`/almoxarifado`) | ✅ [`estoque/COMPORTAMENTO.md`](estoque/COMPORTAMENTO.md) | ✅ `apps/estoque/e2e/*.go.spec.ts` — 24/24, duas vezes seguidas | ✅ Materiais (saldo sempre somado do livro-razão, nunca gravado) + movimentações (entrada/saída/devolução/perda/ajuste, com bloqueio de saldo negativo) + fila de aprovação propose-then-execute (perda/ajuste/solicitação de compra, com bloqueio de auto-aprovação) + solicitação de compra com sugestão automática + envio de e-mail (SMTP nativo, `net/smtp`) + integração HTTP com o RH pra ficha de EPI (2026-08-04) | ⬜ ainda convivendo |
| **RH e SST** (`/rh`) | ✅ [`rh/COMPORTAMENTO.md`](rh/COMPORTAMENTO.md) | ✅ `apps/rh/e2e/*.go.spec.ts` — 65/65 (2026-08-11) | ✅ funcionários com timeline, uniformes com assinatura, treinamentos/turmas, exames ASO, documentos com versionamento, auditorias/NC, importação de funcionários, relatórios Excel/PDF, integração HTTP com o Almoxarifado pra ficha de EPI (2026-08-11) | ⬜ ainda convivendo |
| **Alojamentos** (`/alojamentos`) | ✅ [`alojamentos/COMPORTAMENTO.md`](alojamentos/COMPORTAMENTO.md) | 🟡 regras e integração SQLite cobertas; falta a referência Playwright do canal WhatsApp | ✅ dashboard, alojamentos/quartos, moradores, rotas, pedidos, programação, vínculo de grupo e webhook/conversa WhatsApp com deduplicação (2026-08-11) | ⬜ ainda convivendo |
| **Programação Diária** (`/programacao`) | 🟡 contrato no código e app de referência | 🟡 testes Go; falta Playwright de equivalência | ✅ quadro por dia, frentes, escalas, recursos, funcionários, veículos e funções (2026-08-11) | ⬜ ainda convivendo |

## Compras — módulo novo, fora do escopo original de migração (2026-08-11)

`internal/domain/compras`, `internal/application/compras`, `internal/handlers/compras`
(rotas `/compras`) e a migração `0005_compras_financeiro.sql` chegaram no mesmo commit que
fechou o RH, mas **não são a migração de nenhum app Next.js existente** — não há
`apps/compras`. É funcionalidade nova: transforma uma `SolicitacaoCompra` aprovada no
Almoxarifado em `PedidoCompra` (pedido ao fornecedor), registra `RecebimentoCompra` e gera
`ContaPagar`. Como não migra comportamento de um app já mapeado, o processo de
COMPORTAMENTO.md → suíte Playwright de referência não se aplica da mesma forma — mas o
módulo tem contrato em [`compras/COMPORTAMENTO.md`](compras/COMPORTAMENTO.md), permissão
própria (`ModuloCompras`) e testes de aplicação cobrindo cotação, aprovação, pedido, conferência fiscal, recebimento,
divergências, devolução, estoque e integração financeira idempotente (2026-08-11).

## Financeiro — operação integrada (2026-08-11)

O desenho funcional e a sequência de entrega estão em
[`financeiro/BRIEFING.md`](financeiro/BRIEFING.md). A migração
`0007_financeiro_fundacao.sql` cria o livro em centavos e `0009_financeiro_operacional.sql`
acrescenta faturamento e central fiscal. As rotas `/financeiro` oferecem as abas Financeiro,
Faturamento, Fiscal/SEFAZ, Contas a pagar e Contas a receber. Compras cria obrigação e nota
de entrada; faturamento cria cobrança e solicita emissão fiscal por outbox; o XML autorizado
do emissor Sebrae legado pode ser importado sem duplicidade. O desenho e os limites de
homologação estão em [`financeiro/ABAS_E_AUTOMACOES.md`](financeiro/ABAS_E_AUTOMACOES.md).

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

## Almoxarifado — adaptações conscientes (2026-08-04)

Suíte nova também (`apps/estoque/e2e/*.go.spec.ts`, 24 testes), mesmo motivo dos módulos
anteriores. Divergências deliberadas do Next.js:

- **`Obra` e `Fornecedor` são as tabelas compartilhadas do Painel**, não cópias — o
  Almoxarifado referencia `obras`/`fornecedores` por FK (decisão de banco único). Único ajuste
  de schema: `cnpj`/`email` viraram colunas nullable na tabela `fornecedores` compartilhada
  (só o Almoxarifado as preenche; o Painel deixa nulas). `Obra`/`Fornecedor`, seus
  repositórios e os erros de duplicidade foram extraídos para `internal/domain/cadastro`, com
  aliases de tipo (`type Obra = cadastro.Obra`) no pacote `painel` pra não obrigar nenhum
  arquivo já escrito do Painel a mudar de nome. `BRL`/`DataBR`/`DataLocalBR`/`ParseDataBR`/
  `Fuso` sofreram a mesma extração para `internal/domain/comum`, pelo mesmo motivo.
- **Sem drawer/modais**, mesma decisão dos outros módulos: material e solicitação têm página
  de detalhe própria; Movimentar/Ajustar/Recusar são formulários `<details>` expansíveis.
- **Envio de e-mail é `net/smtp` da stdlib**, não uma biblioteca — a necessidade é só
  autenticação usuário/senha de aplicativo + STARTTLS (587) ou TLS implícito (465), o
  `nodemailer` do Next.js não faz nada que o stdlib não cubra aqui.
- **A integração com o RH é local no binário único**: `clienterh.Local` implementa a
  mesma porta `estoque.ClienteRH` e chama o gerenciador de EPI diretamente. O adaptador HTTP
  e as rotas autenticadas continuam disponíveis como contrato de integração externa.
- **Auto-aprovação bloqueada não tem teste de UI dedicado**: o cenário (mesma pessoa que pediu
  vira quem aprova) só é alcançável se o cargo dela mudar entre o pedido e a decisão — a
  suíte prova o caminho normal (OPERACIONAL pede, GERENTE decide) e a regra em si
  (`aprovacoes.go`, `SolicitanteID == sess.ID`) é coberta pela leitura de código + é a mesma
  checagem, no mesmo formato, que todo o resto da fila de aprovação usa.

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
