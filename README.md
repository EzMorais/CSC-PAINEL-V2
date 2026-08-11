# CSC PAINEL V2 — ERP da Construtora Siqueira Campos

Sistema integrado de gestão (ERP) da Construtora Siqueira Campos, desenvolvido para
substituir planilhas Excel e aplicativos isolados por módulos que **conversam entre si** —
com um login único, aprovações intermediadas e integrações reais entre setores.

A versão V2 nasce da evolução do [CSC-PAINEL](https://github.com/EzMorais/CSC-PAINEL):
mantém os 8 módulos operacionais, mas **migra o núcleo do sistema para um único binário
Go** (Strangler Fig), unificando os bancos de dados de Portal, Painel de Locação, RH,
Almoxarifado e Alojamentos num **banco SQLite único** com tabelas compartilhadas.

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
| [`apps/frota`](apps/frota) | **Frota** | 3000 (web) | Veículos, manutenções e abastecimento (login próprio) |
| [`apps/whatsapp`](apps/whatsapp) | **WhatsApp** | 3006 | Integração: pedidos do Alojamento via WhatsApp (sem tela) |
| [`migracao-go`](migracao-go) | **Migração Go** | 9000 (binário único) | Núcleo do ERP em Go: Portal, Painel, Almoxarifado (RH e Alojamentos em andamento) |

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
| **Alojamentos** (`/alojamentos`) | ⬜ | ⬜ | ⬜ | ⬜ |

> Módulo novo `compras` (`/compras`, contas a pagar) entrou no binário Go sem equivalente em
> Next.js e ainda sem testes automatizados — ver [`migracao-go/README.md`](migracao-go/README.md#compras--módulo-novo-fora-do-escopo-original-de-migração-2026-08-11).

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
módulos leem o crachá de sessão que o Portal assina. Entrando uma vez, a pessoa circula por
todos.

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
extras de abastecimento e dashboard. Login próprio, fora do SSO. Usa `node:sqlite` nativo
(adaptador `vendor/better-sqlite3`), sem módulos nativos.

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
- **Deploy** (em [`docs/deploy.md`](docs/deploy.md)): Docker Compose com 8 serviços + nginx
  em HTTPS (Let's Encrypt com renovação automática), bancos em volumes que sobrevivem a
  rebuilds. Os 6 módulos do SSO no mesmo domínio por portas (`sistemas.SEUDOMINIO:3000`,
  `:3002`, `:3003`, `:3004`, `:3005`, `:3007`); Frota em `frota.SEUDOMINIO` (login próprio).

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

A Frota tem instaladores prontos (`apps/frota/instalar.bat` e `iniciar.bat`), login próprio
(`frota2026`). O WhatsApp exige pareamento por QR code. A migração Go roda com
`go run ./cmd/servidor` dentro de `migracao-go` — o roteiro de cada módulo está em
[`migracao-go/README.md`](migracao-go/README.md).

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
