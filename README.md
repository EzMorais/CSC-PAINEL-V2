# CSC PAINEL V2 — ERP da Construtora Siqueira Campos

Sistema integrado de gestão (ERP) da Construtora Siqueira Campos, desenvolvido para
substituir planilhas Excel e aplicativos isolados por módulos que **conversam entre si** —
com um login único, aprovações intermediadas e integrações reais entre setores.

A versão V2 nasce da evolução do [CSC-PAINEL](https://github.com/EzMorais/CSC-PAINEL):
mantém os 8 módulos operacionais, mas **migra o núcleo do sistema para um único binário
Go** (Strangler Fig), unificando os bancos de dados de Portal, Painel de Locação, RH,
Almoxarifado e Alojamentos num **banco SQLite único** com tabelas compartilhadas.

---

## Estado em 2026-08-11 — para continuar de outra máquina

Duas frentes de trabalho fecharam nesta data (commits mais recentes em `git log`, cada um
com a lista completa de arquivos):

**Segurança e infraestrutura do binário Go** (`a42b798`…`1c33bf5`…`4d1390c`):
- **Corrigido um P0 real**: Painel, Almoxarifado, RH e Alojamentos em Go só exigiam sessão
  válida, sem checar se o Portal tinha liberado aquele módulo pra pessoa — qualquer usuário
  logado lia módulos inteiros que não eram dele. Os 4 handlers ganharam o mesmo gate de
  `identidade.TemAcesso` que Financeiro/Programação/Compras já usavam, com teste de
  regressão por módulo.
- Migration `0010_programacao.sql` renomeada pra `0011` (colidia de prefixo com
  `0010_financeiro_controles.sql`).
- CI (`.github/workflows/ci.yml`) passou a rodar o E2E de RH e Almoxarifado contra o binário
  Go (antes só Frota/Portal/Painel), e o job de E2E passou a rodar em `pull_request`, não só
  em push pra `main`.
- `migracao-go` ganhou `Dockerfile`, entrou no `docker-compose.yml` (porta 3010) e no
  `nginx/nginx.conf` — antes não tinha jeito de colocar o binário no ar em produção.
- Detalhe completo e o que ainda falta: [`ERP_BRIEFING_MELHORIA.md`](ERP_BRIEFING_MELHORIA.md).

**Frota entrou no grupo de login único (SSO)** — mudança maior, feita por último:
- Antes: login e `AUTH_SECRET` próprios, tabela de usuários separada (Drizzle), subdomínio
  `frota.SEUDOMINIO.com.br:443`.
- Depois: sem login nem tabela de usuários própria — `apps/frota/src/lib/auth.ts` só lê o
  mesmo cookie `locacao_sessao` que RH/Painel/Almoxarifado leem. O papel dela lá dentro
  (ADMIN/OPERADOR) é derivado do cargo do Portal (ADMIN/DIRETORIA → ADMIN, resto →
  OPERADOR), **exige o módulo Frota liberado pra pessoa no Portal**. Em produção, saiu do
  subdomínio próprio e entrou no grupo `sistemas.SEUDOMINIO.com.br`, porta **3006**.
  Decisão registrada: o Frota não precisa mais funcionar instalado sozinho, sempre sobe
  junto do resto do ERP.
- Build e `tsc --noEmit` do `apps/frota` validados localmente; **não testado ainda contra um
  Portal rodando de verdade** (login real de ponta a ponta) nem contra um VPS.

**Trabalho de outra sessão, já commitado** (`316ea13`, não detalhado aqui — ver a própria
mensagem do commit): dashboards de Painel/Almoxarifado/RH/Alojamentos padronizados, Compras
incorporado ao layout compartilhado, cadastro de funcionários e ficha de cargos completos,
importadores de inventário e programação, `docs/BRIEFING_ERP_CONSTRUTORA.md` e
`docs/REVISAO_SETORES_E_DADOS_ERP.md` novos.

**Para continuar em outra máquina**: `git pull`, depois `apps/frota/.env` precisa do mesmo
`AUTH_SECRET` que `apps/portal/.env` (copie, como os outros módulos — ver "Rodar localmente"
abaixo) e de `NEXT_PUBLIC_URL_PORTAL` apontando pro Portal/binário Go. Sem isso o Frota some
com a sessão de todo mundo, não só do login antigo dele. O primeiro teste manual completo
(entrar pelo Portal → navegar até o Frota sem pedir login de novo) ainda não foi feito e é o
próximo passo natural.

---

## O ERP em uma página

| Sistema | Módulo | Porta | Para que serve |
|---|---|---|---|
| [`apps/portal`](apps/portal) | **Portal** | 3004 | Entrada de tudo: login, usuários, cargos e hub de navegação |
| [`apps/painel-locacao`](apps/painel-locacao) | **Painel de Locação** | 3000 | Equipamentos alugados por obra, com alerta de vencimento |
| [`apps/rh`](apps/rh) | **RH e SST** | 3002 | Funcionários, treinamentos, exames, EPIs, uniformes, auditorias |
| [`apps/estoque`](apps/estoque) | **Almoxarifado** | 3003 | Materiais, saldos por obra, compras e EPIs |
| [`apps/programacao`](apps/programacao) | **Programação Diária** | 3007 | Escala diária de equipes, veículos e máquinas por frente |
| [`apps/alojamentos`](apps/alojamentos) | **Alojamentos** | 3005 | Gestão de moradores e pedidos de alojamento |
| [`apps/frota`](apps/frota) | **Frota** | 3000 (web) | Veículos, manutenções e abastecimento — no SSO desde 2026-08-11 |
| [`apps/whatsapp`](apps/whatsapp) | **WhatsApp** | 3006 | Integração: pedidos do Alojamento via WhatsApp (sem tela) |
| [`migracao-go`](migracao-go) | **Migração Go** | 3010 (binário único) | Núcleo do ERP em Go: Portal, Painel, Almoxarifado, RH, Alojamentos, Compras, Financeiro e Programação |

> O **Painel de Locação** migrado para Go responde em `/painel` no binário único; o app
> Next.js original segue na porta 3000 enquanto a migração não é concluída.

---

## Estado da migração para Go (V2)

O processo é **incremental** com TDD obrigatório: cada módulo tem uma suíte Playwright de
referência que roda contra o Next.js hoje e contra o Go depois, provando equivalência
funcional antes de desligar o Next.js daquele módulo.

| Módulo | Comportamento mapeado | Testes de referência | Implementação Go | Next.js removido |
|---|---|---|---|---|
| **Portal** (`/` ou `/portal`) | ✅ | ✅ 20/20 | ✅ login, usuários, hub | ⬜ convivendo (4 apps Next.js seguem no ar) |
| **Painel de Locação** (`/painel`) | ✅ | ✅ 18/18 | ✅ CRUD completo + importador/exportador Excel/PDF | ⬜ convivendo |
| **Almoxarifado** (`/almoxarifado`) | ✅ | ✅ 24/24 | ✅ materiais, movimentações, aprovações, compras, e-mail, EPIs | ⬜ convivendo |
| **RH e SST** (`/rh`) | ✅ | ✅ 65/65 | ✅ funcionários, uniformes, treinamentos, exames, documentos, auditorias, importação, relatórios, integração de EPI | ⬜ convivendo |
| **Alojamentos** (`/alojamentos`) | ✅ | 🟡 regras Go cobertas; Playwright pendente | ✅ gestão completa + webhook/conversa WhatsApp | ⬜ convivendo |
| **Programação Diária** (`/programacao`) | 🟡 | 🟡 testes Go; Playwright pendente | ✅ quadro diário, frentes, equipes, veículos e funções | ⬜ convivendo |

> O módulo novo `compras` (`/compras`) entrou no binário Go sem equivalente em Next.js.
> Possui testes de aplicação/integração e controle de acesso próprio; veja
> [`migracao-go/README.md`](migracao-go/README.md#compras--módulo-novo-fora-do-escopo-original-de-migração-2026-08-11).

**Decisões-chave do V2:**

- **Banco único** (2026-08-04): um SQLite só, bem modelado. `Obra` e `Fornecedor` (que se
  duplicavam em 4 apps) viram **tabelas compartilhadas com FK**, não cópias por domínio.
- **Clean Architecture / Ports and Adapters**: o domínio nunca importa SQLite — as portas
  ficam em `internal/repositories/`, os adaptadores em `internal/infrastructure/database/`.
- **Frota fora do escopo da migração** (decisão de 2026-08-04): continua Next.js + Drizzle,
  com banco e login próprios.
- **SQLite de produção**: WAL, `busy_timeout`, `foreign_keys = ON`, transações explícitas,
  prepared statements via `sqlc`.

Detalhes completos em [`migracao-go/README.md`](migracao-go/README.md) e
[`migracao-go/ARQUITETURA.md`](migracao-go/ARQUITETURA.md).

---

## Como os módulos conversam

### Login único (SSO)

**Comece pelo Portal.** É ele que tem a tela de login e o cadastro de usuários; os outros
módulos — inclusive o Frota, desde 2026-08-11 — leem o crachá de sessão que o Portal assina.
Entrando uma vez, a pessoa circula por todos. Frota é o único do grupo sem cargo próprio: o
papel que ele mostra (ADMIN/OPERADOR) é derivado do cargo do Portal na hora de ler a sessão,
não guardado em lugar nenhum.

Enquanto o Go convive com os apps Next.js, a sessão usa **cookie assinado com o mesmo
`AUTH_SECRET`** em todos os `.env`. Quando a migração terminar, a sessão passa a ser do
processo único — sem token cruzando fronteira de serviço.

### Cargos e permissões

O cadastro de pessoas é **um só**, no Portal. Cada pessoa tem um cargo **e** a lista de
quais sistemas acessa.

| Cargo | O que faz |
|---|---|
| **Administrador** | Cadastra usuários e mexe nas configurações. Faz tudo. |
| **Diretoria** | Vê tudo e aprova tudo. Não cadastra usuários nem lança no dia a dia. |
| **Gerente / Engenheiro** | Confere e aprova o que a equipe lançou, nos módulos a que tem acesso. |
| **Operacional** | Lança o dia a dia. Não aprova o próprio lançamento. |
| **Consulta** | Só lê. Para quem acompanha sem poder alterar. |

Princípio central: **quem lança não aprova**. Nem um gerente aprova um pedido feito por ele
mesmo — o Almoxarifado bloqueia auto-aprovação.

### Integração RH ↔ Almoxarifado (NR-6)

Quando um **EPI sai do estoque, ele sai para uma pessoa, não para uma obra** — e vira
automaticamente a ficha de entrega no RH (NR-6). A ficha vai com número do CA e validade.
Se o RH estiver fora na hora, a saída acontece do mesmo jeito e a ficha fica pendente, com
botão de reenviar na tela de Movimentações. O reenvio é seguro: o RH reconhece ficha já
recebida e não duplica.

No V2 com a migração em progresso, essa troca continua acontecendo por HTTP com token
assinado (60s de validade) — o contrato `estoque.ClienteRH` está isolado atrás de uma
porta de domínio, pronta para virar chamada local quando o RH migrar.

### Programação Diária ↔ Portal, RH e Frota

Consulta o Portal (cargos, permissões, máquinas do catálogo), o RH (funcionários oficiais)
e a Frota (veículos e situação de manutenção). Quando um sistema não responde, o quadro
continua disponível com lançamento manual.

### Alojamentos ↔ WhatsApp

O serviço de WhatsApp (Baileys, dispositivo vinculado) liga o número corporativo aos
pedidos do Alojamento: no grupo, mensagem começando com `#pedido` vira pedido com tipo
detectado da frase (torneira → manutenção; sabão → limpeza). WhatsApp é só transporte —
toda decisão mora no Alojamentos.

---

## Aprovações no Almoxarifado

Três coisas que o Operacional **pede** e a gerência **autoriza** — modelo
*propose-then-execute*:

1. **Ajuste de inventário** acima da diferença configurada.
2. **Perda ou quebra**, sempre.
3. **Solicitação de compra** acima do valor configurado.

Enquanto o pedido aguarda, **nada mudou**: saldo continua o mesmo e nenhum e-mail saiu. O
efeito acontece na aprovação. Fazer o contrário (executar e desfazer se recusado) deixaria
o estoque errado no meio do caminho — e, na compra, um e-mail no fornecedor que não dá para
desenviar.

---

## Módulos em detalhe

### Portal — identidade e acesso
Login, usuários, cargos e permissões. Guarda o cadastro único de pessoas, o catálogo de
máquinas usado pela Programação e o **hub de navegação** que leva a todos os módulos.
Migrado para Go: sessão, autenticação e hub validados (20/20 testes de referência).

### Painel de Locação — equipamentos alugados por obra
Substitui um app em Tkinter que usava planilha Excel como banco. Importa planilha,
calcula a situação (Ativa / Vencendo / Vencida / Devolvida) **automaticamente** a partir da
data de fim — status não é campo gravado — e devolver não apaga: vira histórico com a data
de início original. Importador validado byte-exato contra a planilha real (305 locações,
242 itens, 63 devoluções). No Go, navegação servidor-renderizada em vez de modais.

### RH e SST — pessoas e segurança do trabalho
Funcionários com linha do tempo, uniformes com assinatura digital, treinamentos com turmas
e certificados (reciclagem vencida em destaque), exames ASO, documentos da empresa/obra
(PGR, PCMSO, LTCAT) com versionamento, checklist de admissão, auditorias que abrem não
conformidades. EPIs: a entrega vem **só** do Almoxarifado. Migrado para Go com a suíte de
referência inteira passando (65/65 testes).

### Almoxarifado — materiais, saldos e compras
**Não existe campo de saldo editável** — o saldo é sempre somado do livro-razão. Conferência
de contagem física calcula e lança ajuste sozinho. Saída maior que o saldo é recusada.
Sugestão de compra junta tudo abaixo do mínimo; envio por e-mail via SMTP nativo
(Gmail/Outlook, senha de aplicativo), com reenvio em caso de falha. Migrado para Go com fila
de aprovação propose-then-execute (24/24 testes).

### Programação Diária — escala por frente
Quadro por frente de trabalho: escala funcionários, avulsos, veículos, máquinas e avisos;
copia o dia anterior respeitando inativos; detecta conflitos; publica e gera imagem para
WhatsApp. Implementa o antigo `painel-lucas` (referência histórica).

### Alojamentos — moradores e pedidos
Gestão de moradores, alocações e pedidos com recebimento via WhatsApp (serviço dedicado).
Integração opcional com Google Maps para autocompletar endereço de obra.

### Frota — veículos, manutenções e abastecimento
Hodômetro de revisão, manutenções com foto/PDF, abastecimento à mão ou CSV do posto,
alertas e exportação da **planilha da diretoria** no formato exato já recebido — com abas
extras de abastecimento e dashboard. Entrou pro SSO em 2026-08-11 (antes tinha login e
`AUTH_SECRET` próprios): não tem mais conta de usuário separada, o papel de cada pessoa
(ADMIN/OPERADOR) vem do cargo dela no Portal, e o módulo Frota precisa estar liberado pra
ela lá. Usa `node:sqlite` nativo (adaptador `vendor/better-sqlite3`), sem módulos nativos.

### WhatsApp — serviço de integração
Sem tela. Conecta o número corporativo como dispositivo vinculado (Baileys) e repassa
mensagens para `/api/integracao/whatsapp/recebida` no Alojamentos. Regras rígidas: só
responde a quem escreveu primeiro, só avisa quem tem pedido em aberto, espaça os envios.

---

## Stack e arquitetura

- **8 apps em `apps/*`** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
  Prisma 6 + SQLite (Drizzle + SQLite no Frota).
- **`migracao-go/`** — núcleo do ERP em Go 1.2x + Templ + HTMX (mínimo) + `database/sql`/
  `sqlc`, Clean Architecture (Ports and Adapters), banco único SQLite com WAL. Testes de
  domínio sem banco (mock das portas), integração contra SQLite real e Playwright de
  equivalência funcional.
- **Design system** (em [`docs/design-system.md`](docs/design-system.md)): neutro + acento
  por app (Portal azul, Locação índigo, RH verde-azulado, Almoxarifado terracota, Alojamentos
  âmbar), sidebar sempre escura e colapsável, Inter + JetBrains Mono, sem glow/glassmorphism/
  gradientes exagerados.
- **Deploy** (em [`docs/deploy.md`](docs/deploy.md)): Docker Compose com 9 serviços + nginx
  em HTTPS (Let's Encrypt com renovação automática), bancos em volumes que sobrevivem a
  rebuilds. Os 8 sistemas do SSO (inclusive Frota, desde 2026-08-11, e o binário Go) no
  mesmo domínio por portas (`sistemas.SEUDOMINIO:3000`, `:3002`, `:3003`, `:3004`, `:3005`,
  `:3006`, `:3007`, `:3010`).

---

## Rodar localmente

O **Portal é obrigatório** — é ele que guarda os usuários. Os outros módulos copiam o `.env`
dele para herdar o mesmo `AUTH_SECRET`.

```bash
# apps/portal — primeiro
npm install
echo DATABASE_URL="file:./dev.db" > .env
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev          # http://localhost:3004
```

Login padrão: `admin@siqueiracampos.com.br` / `locacao2026` (troque depois do primeiro
acesso).

```bash
# apps/painel-locacao, apps/rh, apps/estoque, apps/programacao, apps/alojamentos
copy ..\portal\.env .env      # mesmo AUTH_SECRET
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

A Frota entrou pro SSO em 2026-08-11 — copie o `.env` do Portal como os outros módulos
(`AUTH_SECRET` compartilhado) e rode `npm install && npm run dev -- -p 3000`; não tem mais
login nem `npm run seed` de usuário próprios (os instaladores `.bat` em `apps/frota/` são da
época em que rodava isolado — ver `apps/frota/README.md`). O WhatsApp exige pareamento por QR
code. A migração Go roda com `go run ./cmd/servidor` dentro de `migracao-go` — o roteiro de
cada módulo está em [`migracao-go/README.md`](migracao-go/README.md).

Passo a passo completo, guia de primeiros passos e problemas comuns estão no repositório
principal ([CSC-PAINEL](https://github.com/EzMorais/CSC-PAINEL)), que mantém a documentação
de instalação e uso da versão estável.

---

## Segurança e dados

Repositório **privado** — descreve a operação de uma empresa real.

- Bancos (`*.db`), planilhas de dados reais, arquivos exportados e `.env` **nunca sobem ao
  Git** (`.gitignore` na raiz, em `apps/` e em `migracao-go/`).
- Dados de exemplo são fictícios; dados reais de clientes, fornecedores e funcionários ficam
  em arquivos locais git-ignored (`prisma/dados-locais.json` etc.).
- A pasta `sessao/` do WhatsApp são as credenciais do número — não versionar, não
  compartilhar.

---

## Documentação

| Documento | O que é |
|---|---|
| [`docs/design-system.md`](docs/design-system.md) | Tokens, componentes e identidade visual |
| [`docs/deploy.md`](docs/deploy.md) | Roteiro de deploy em VPS com Docker + HTTPS |
| [`docs/backlog.md`](docs/backlog.md) | Backlog de deploy (issues no GitHub) |
| [`migracao-go/README.md`](migracao-go/README.md) | **A evolução V2**: plano e status da migração para Go |
| [`migracao-go/ARQUITETURA.md`](migracao-go/ARQUITETURA.md) | Arquitetura do binário Go único |
| [`apps/painel-locacao/README.md`](apps/painel-locacao/README.md) | Detalhes do Painel de Locação |
| [`apps/frota/README.md`](apps/frota/README.md) | Detalhes da Frota |
| [`apps/programacao/README.md`](apps/programacao/README.md) | Detalhes da Programação Diária |
| [`apps/whatsapp/README.md`](apps/whatsapp/README.md) | Detalhes do serviço de WhatsApp |
