# CSC PAINEL V2 — briefing de melhoria do ERP

> Auditoria de 2026-08-11 sobre o estado real do código (não só do que os READMEs dizem).
> Cobre os dois lados do Strangler Fig: o binário Go (`migracao-go/`) e os apps Next.js
> (`apps/*`) que ainda convivem com ele. Não duplica
> [`migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md`](migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md)
> (Financeiro/Compras já têm backlog próprio) — só referencia e prioriza no contexto do ERP
> inteiro.

## Resumo executivo

> **Atualização de 2026-08-11 (mesmo dia, sessões seguintes):** P0-1 (controle de acesso
> ausente em 4 módulos), P0-2 (migration `0010` duplicada), P1-4 (CI sem RH/Estoque no E2E e
> só rodando em `main`) e P1-5 (`migracao-go` fora do `docker-compose.yml`) foram corrigidos
> — ver "Resolvido" nas seções correspondentes abaixo. O texto original da auditoria foi
> mantido para registro; o que mudou está marcado inline. Nota: durante essas sessões havia
> outra sessão em paralelo mexendo em `templates/layout/*` (provável adoção do HUD do item
> 3) e em RH/Compras — este arquivo não reflete esse trabalho, que segue não commitado.

~~O maior risco hoje não é falta de funcionalidade — é **controle de acesso**: Financeiro,
Programação Diária e Compras checam se a pessoa tem o módulo liberado antes de servir a
página. Painel, Almoxarifado, RH e Alojamentos ainda exigem apenas uma sessão válida.~~
**Corrigido**: os 4 módulos restantes (Painel, Almoxarifado, RH, Alojamentos) agora checam
`identidade.TemAcesso` antes de servir qualquer rota, com teste de regressão por módulo. Ver
P0 item 1.

Depois disso, os problemas mudam de natureza: divergência visual entre Go e Next.js (o Next.js
mudou de layout e o Go não acompanhou), lacunas de teste automatizado (E2E cobre 3 dos 8 apps,
handlers Go quase sem teste nenhum — o gate de acesso corrigido acima agora tem teste, o
resto do handler continua sem) e documentação desatualizada (dois READMEs não mencionam
módulos que já existem).

## Estado atual por sistema

| Sistema | Onde roda | Situação real |
|---|---|---|
| Portal/Identidade | Go (`/`) + Next.js (3004, convivendo) | Sólido — login, usuários, hub; único módulo cuja gate por módulo é usada corretamente no próprio código do hub |
| Painel de Locação | Go (`/painel`) + Next.js | Funcional; controle de acesso por módulo corrigido em 2026-08-11 |
| Almoxarifado | Go (`/almoxarifado`) + Next.js | Funcional; controle de acesso por módulo corrigido em 2026-08-11 |
| RH e SST | Go (`/rh`) + Next.js | Mais completo do binário (65/65 testes de referência); controle de acesso por módulo corrigido em 2026-08-11 |
| Alojamentos | Go (`/alojamentos`) + Next.js | Gestão e webhook/conversa WhatsApp portados; controle de acesso por módulo corrigido em 2026-08-11; falta Playwright de equivalência |
| Compras | Só Go (`/compras`, sem app Next.js) | Funcional, testado e protegido por módulo; ainda sem usar a casca visual compartilhada (ver §2.3 do BRIEFING_FINANCEIRO_COMPRAS.md) |
| Financeiro | Só Go (`/financeiro`) | O mais maduro: outbox com lease/retentativa/dead-letter, fechamento de competência com trigger SQL, estorno transacional — tudo implementado desde a última auditoria. Falta perfil de tesouraria dedicado e conciliação bancária |
| Programação Diária | Go (`/programacao`) + Next.js (3007) | Portado nesta sessão; controle de acesso correto desde o início |
| Frota | Só Next.js (login próprio) | Fora do escopo da migração por decisão registrada; não auditado a fundo aqui |
| WhatsApp | Serviço Next.js sem tela (Baileys) | Existe, tem Dockerfile próprio; não auditado a fundo nesta rodada |

## P0 — bloqueia confiar no sistema como está

### 1. Controle de acesso por módulo ausente em 4 módulos Go — ✅ Resolvido em 2026-08-11

Cada um dos 4 handlers ganhou um `sessao()` no mesmo padrão de `financeiro.go`/
`programacao.go` (`ExigirSessao` + `identidade.TemAcesso(*sess, identidade.ModuloX)`, 403 se
faltar o módulo), e todo o resto do pacote passou a chamar esse `sessao()` em vez de
`h.Sessoes.ExigirSessao` direto:

- `internal/handlers/painel/handlers.go` — `ModuloPainel`; `exportar.go` (rotas de download,
  que respondem 401/403 sem redirect) ganhou o mesmo gate via `exigirSessaoDownload`.
- `internal/handlers/estoque/handlers.go` — `ModuloEstoque`.
- `internal/handlers/rh/handlers.go` — `ModuloRH`; `relatorios.go` (mesma situação de rota de
  download) ganhou o gate em `exigirSessaoManual`. As rotas `/api/integracao/...`
  (`integracao.go`, autenticadas por token de máquina, não por cookie de sessão) ficaram de
  fora de propósito — não são navegadas por uma pessoa logada.
- `internal/handlers/alojamentos/alojamentos.go` — `ModuloAlojamentos`; único módulo que já
  centralizava tudo num `sessao()` só, então bastou adicionar o `TemAcesso` ali dentro.

Cada pacote ganhou `handlers_test.go` com 3 casos (bloqueia sem o módulo, libera com o módulo,
ADMIN sempre libera) — a lacuna que a auditoria original apontava ("nenhum teste pegaria essa
falha") deixou de existir para o gate em si. `go build`, `go vet` e `go test ./...` passam
limpos no módulo inteiro.

<details>
<summary>Diagnóstico original (2026-08-11, antes da correção) — clique para expandir</summary>

Confirmado por leitura direta do código: `identidade.TemAcesso(sess, identidade.ModuloX)` só
aparecia nos handlers de Financeiro, Programação e Compras, além do hub da identidade. Nos
quatro módulos restantes, o piso de toda rota era só `Sessoes.ExigirSessao` (+
`PodeLancar`/`PodeAprovar` para escrita). `cmd/servidor/main.go` monta as rotas com
`mux.HandleFunc` puro — não havia (e continua não havendo) middleware de gate por módulo;
os usos de `dominioIdentidade.ModuloPainel/ModuloRH/ModuloEstoque` em `main.go` são só para
montar URL de tile do hub, não para bloquear acesso.

**Efeito prático que isso permitia**: qualquer pessoa logada — inclusive cargo `CONSULTA` de
um módulo qualquer — lia (e, dependendo do cargo, editava) Painel de Locação, Almoxarifado, RH
e Alojamentos inteiros, mesmo que o Portal nunca tivesse liberado esses módulos pra ela. O
cargo bloqueava escrita indevida (`PodeLancar`/`PodeAprovar`), mas não bloqueava leitura —
alguém do RH conseguia ver toda a operação financeira do Painel de Locação, por exemplo.

**Por que era P0 e não só mais um item de backlog**: é o tipo de falha que não aparece testando
o caminho feliz (a pessoa que testa geralmente é ADMIN, que sempre vê tudo por regra). Só
aparece com um usuário de cargo/módulo limitado — exatamente o cenário que a permissão existe
pra cobrir.

</details>

### 2. Duas migrations `0010` — ✅ Resolvido em 2026-08-11

`migrations/0010_programacao.sql` virou `0011_programacao.sql` (ao lado de
`0010_financeiro_controles.sql`, que ficou como estava). Como `AplicarMigracoes`
(`internal/infrastructure/database/migracoes.go`) usa o nome do arquivo como chave em
`schema_migrations`, o rename por si só faria os dois SQLite de desenvolvimento que já tinham
essa migration aplicada (`migracao-go/servidor.db`, `migracao-go/portal.db` — ambos
gitignorados) tentarem rodá-la de novo no próximo start e falhar em `CREATE TABLE`
(`0010_programacao.sql` não é idempotente). Os dois bancos locais tiveram a linha
`schema_migrations` correspondente atualizada manualmente pra `0011_programacao.sql` antes do
rename entrar no repositório, então não há passo extra pra rodar. Um banco novo (checkout
limpo) nunca teve `0010_programacao.sql` gravado, então não é afetado.

## P1 — o que falta para a migração fechar com qualidade

### 3. Go e Next.js divergiram de novo — agora em layout, não só em conteúdo

Depois do commit que apliquei nesta sessão (lista completa no hub flutuante do Go), outro
trabalho paralelo mudou o padrão visual dos apps Next.js: todos passaram a ter um **HUD
superior fixo** (`hud-programacao.tsx`, uma barra `sticky top-0` com marca, navegação
horizontal entre módulos e bloco do usuário) **além** do hub flutuante — não em substituição a
ele. `docs/design-system.md` já documenta esse novo modelo (seção "Layout e HUD"). O binário Go
continua só com a sidebar esquerda antiga (`templates/layout/sidebar.templ`) — não tem
nenhum conceito de "HUD superior". Resultado: navegar do Go pra qualquer app Next.js (ou
vice-versa) agora troca de paradigma de navegação inteiro, não só de cor.

Isso não é urgente do jeito que o item 1 é, mas é a próxima coisa que vai chamar atenção de
quem usa o sistema todo dia — e quanto mais módulos o Go absorver sem esse ajuste, maior o
retrabalho depois.

### 4. CI cobre bem o Go, cobre pela metade os testes de referência que sustentam a migração — 🟡 Parcialmente resolvido em 2026-08-11

`.github/workflows/ci.yml` agora roda o E2E de **5 dos 8 apps** (Frota, Portal, Painel de
Locação, RH, Almoxarifado — os dois últimos adicionados nesta sessão, `apps/rh` e
`apps/estoque`, contra `playwright.go.config.ts`, validados localmente antes do commit: 65/65
e 24/24), e o gatilho passou a incluir `pull_request` além de push pra `main` — uma quebra
agora aparece antes do merge, não depois.

Alojamentos e Programação Diária continuam de fora: nenhum dos dois tem suíte Playwright
nenhuma no repositório ainda (`apps/alojamentos/e2e/` e `apps/programacao/e2e/` vazios) — não
é configuração de CI que falta, é escrever a suíte inteira contra o binário Go, do zero.

`docs/WORKFLOW_CI.md` continua com a ressalva de que o workflow nunca rodou de verdade num
runner do GitHub (só localmente e por leitura) — não dá pra confirmar isso a partir deste
ambiente, que não tem acesso a disparar Actions.

### 5. `docker-compose.yml` não tem serviço nenhum pro binário Go — ✅ Resolvido em 2026-08-11

`migracao-go/Dockerfile` (multi-stage; `_templ.go` já vem versionado, então é `go build`
comum) + serviço `migracao-go` no `docker-compose.yml` (porta 3010, mesma da convenção de
dev) + bloco no `nginx/nginx.conf` no mesmo domínio dos outros 6 do grupo de SSO +
`migracao-go/.env.production.example` + `docs/deploy.md` atualizado (tabela de endereços,
passo do `AUTH_SECRET` compartilhado agora com 8 arquivos, firewall, backup). O binário
continua convivendo com os Next.js equivalentes — isto só o deixa deployável junto, não
desliga nenhum app Next.js. Não validado num VPS real (sem Docker neste ambiente); validado
localmente: `go build` com os mesmos flags do Dockerfile (`CGO_ENABLED=0`) e
`docker-compose.yml`/`nginx.conf` com sintaxe conferida.

<details>
<summary>Diagnóstico original (2026-08-11, antes da correção)</summary>

O compose subia os 8 apps Next.js + nginx, mas não subia `migracao-go` — apesar de ser,
segundo o próprio README, "o núcleo do sistema" pro qual tudo está migrando. Não existia
um jeito documentado/scriptado de colocar o binário Go no ar junto do resto em produção; só
`scripts/iniciar-projeto.ps1`, que é orquestração de desenvolvimento local, não deploy.

</details>

### 6. Documentação principal atualizada em 2026-08-11

Os dois READMEs agora registram Alojamentos, Compras, Financeiro e Programação Diária sem
ocultar as suítes Playwright e os cortes de legado que continuam pendentes.

Como este projeto trata `COMPORTAMENTO.md`/README como parte do processo (é o documento que
vira suíte de teste de referência), deixar esses dois desatualizados quebra o próprio método
que o time adotou.

### 7. Teste automatizado: forte na aplicação, quase ausente no handler

**Parcialmente resolvido em 2026-08-11**: `painel`, `estoque`, `rh` e `alojamentos` ganharam
`internal/handlers/<módulo>/handlers_test.go`, mas só cobrindo o gate de acesso do item 1
(bloqueia sem o módulo liberado / libera com o módulo / ADMIN sempre libera) — é o suficiente
pra travar uma regressão nesse gate especificamente, não uma suíte de handler completa.
`handlers/compras` e `handlers/programacao` continuam sem nenhum teste, e o resto do
comportamento de cada handler (CRUD, validação de formulário, etc.) segue coberto só
indiretamente pelos testes de aplicação e pela suíte Playwright de referência quando ela
existe.

Na camada de aplicação a cobertura continua parcial: `painel/{dashboard,fornecedores,locacoes,
obras}.go`, `estoque/{materiais,solicitacoes,configuracao_email,limites,numero,dashboard}.go` e
a maior parte de `rh/*.go` não têm teste dedicado.

### 8. Nenhuma listagem do binário Go pagina

Confirmado em Painel (`LocacaoRepositorio.Listar`), Almoxarifado (`MaterialRepositorio.Listar`,
`SolicitacaoRepositorio.Listar` sem filtro nenhum) e RH (`FuncionarioRepositorio.Listar`,
`CargoRepositorio.Listar`, `DepartamentoRepositorio.Listar`) — mesmo padrão já documentado
para Financeiro/Compras no outro briefing. Funciona hoje porque o volume de dados ainda é
pequeno; não escala.

## P2 — observações menores, não bloqueiam nada hoje

- **Segredos de desenvolvimento hardcoded**: `scripts/iniciar-projeto.ps1` tem um fallback
  fixo (`AUTH_SECRET`). Não é segredo de produção vazado — é valor de conveniência pra rodar
  local sem `.env` — mas merece um comentário deixando isso explícito, porque um valor fixo
  em texto puro sempre levanta suspeita numa auditoria rápida. (O `FROTA_AUTH_SECRET`
  separado que existia aqui foi removido em 2026-08-11, quando o Frota entrou pro grupo de
  SSO — agora usa o mesmo `$segredoAuth` de todo mundo.)
- **Credencial padrão do seed** (`admin@siqueiracampos.com.br` / `locacao2026`) está
  documentada em texto puro em vários lugares (`docs/deploy.md`, `cmd/seed/main.go`, scripts de
  e2e). Esperado pra um seed de desenvolvimento — só reforça que trocar essa senha é passo
  obrigatório de qualquer deploy real, o que `docs/deploy.md` já menciona.
- Nenhum segredo real, chave de API ou `.env` de verdade encontrado versionado — a higiene de
  `.gitignore` está correta em todos os apps.
- **WhatsApp** (`apps/whatsapp`) e **Frota** não foram auditados a fundo nesta rodada — ambos
  fora do escopo direto da migração Go, mas valem uma passada futura.

## Ordem de ataque recomendada

1. ~~**Controle de acesso por módulo** nos 4 handlers que faltam~~ — ✅ feito em 2026-08-11.
2. ~~Renomear a migration `0010` duplicada~~ — ✅ feito em 2026-08-11.
3. Decidir (não necessariamente implementar já) se o binário Go adota o HUD superior novo ou
   se os apps Next.js voltam à sidebar — hoje o ERP tem os dois modelos coexistindo, e quanto
   mais tempo passar, mais módulos vão nascer no padrão "errado".
4. ~~Ligar Playwright de RH/Estoque no CI, e mover E2E pra rodar em PR~~ — ✅ feito em
   2026-08-11. Alojamentos/Programação ainda faltam, mas isso é escrever a suíte do zero
   (ver item 4 acima), não configuração — fica como item novo, maior, mais abaixo.
5. Manter os dois READMEs sincronizados com cada corte de legado.
6. ~~Adicionar `migracao-go` ao `docker-compose.yml`~~ — ✅ feito em 2026-08-11 (não validado
   num VPS real).
7. Teste de handler completo (além do gate de acesso, já coberto) + paginação entram como
   trabalho de fundo, não bloqueiam nada imediato.
8. Escrever a suíte Playwright de referência de Alojamentos e Programação Diária contra o
   Go, do zero — só depois disso os dois entram no CI (item 4).

Itens específicos de Financeiro (perfis de tesouraria, conciliação bancária, rateio/categoria)
e Compras (casca visual, devolução sem estorno, contrato recorrente sem job) continuam
priorizados em
[`migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md`](migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md) —
não repetidos aqui.
