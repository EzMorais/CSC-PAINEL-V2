# CSC PAINEL V2 — briefing de melhoria do ERP

> Auditoria de 2026-08-11 sobre o estado real do código (não só do que os READMEs dizem).
> Cobre os dois lados do Strangler Fig: o binário Go (`migracao-go/`) e os apps Next.js
> (`apps/*`) que ainda convivem com ele. Não duplica
> [`migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md`](migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md)
> (Financeiro/Compras já têm backlog próprio) — só referencia e prioriza no contexto do ERP
> inteiro.

## Resumo executivo

O maior risco hoje não é falta de funcionalidade — é **controle de acesso**: Financeiro,
Programação Diária e Compras checam se a pessoa tem o módulo liberado antes de servir a
página. Painel, Almoxarifado, RH e Alojamentos ainda exigem apenas uma sessão válida.

Depois disso, os problemas mudam de natureza: divergência visual entre Go e Next.js (o Next.js
mudou de layout e o Go não acompanhou), lacunas de teste automatizado (E2E cobre 3 dos 8 apps,
handlers Go quase sem teste nenhum) e documentação desatualizada (dois READMEs não mencionam
módulos que já existem).

## Estado atual por sistema

| Sistema | Onde roda | Situação real |
|---|---|---|
| Portal/Identidade | Go (`/`) + Next.js (3004, convivendo) | Sólido — login, usuários, hub; único módulo cuja gate por módulo é usada corretamente no próprio código do hub |
| Painel de Locação | Go (`/painel`) + Next.js | Funcional, mas sem controle de acesso por módulo |
| Almoxarifado | Go (`/almoxarifado`) + Next.js | Funcional, mas sem controle de acesso por módulo |
| RH e SST | Go (`/rh`) + Next.js | Mais completo do binário (65/65 testes de referência), mas sem controle de acesso por módulo |
| Alojamentos | Go (`/alojamentos`) + Next.js | Gestão e webhook/conversa WhatsApp portados; falta Playwright e controle de acesso por módulo |
| Compras | Só Go (`/compras`, sem app Next.js) | Funcional, testado e protegido por módulo; ainda sem usar a casca visual compartilhada (ver §2.3 do BRIEFING_FINANCEIRO_COMPRAS.md) |
| Financeiro | Só Go (`/financeiro`) | O mais maduro: outbox com lease/retentativa/dead-letter, fechamento de competência com trigger SQL, estorno transacional — tudo implementado desde a última auditoria. Falta perfil de tesouraria dedicado e conciliação bancária |
| Programação Diária | Go (`/programacao`) + Next.js (3007) | Portado nesta sessão; é, junto do Financeiro, o único módulo com controle de acesso correto |
| Frota | Só Next.js (login próprio) | Fora do escopo da migração por decisão registrada; não auditado a fundo aqui |
| WhatsApp | Serviço Next.js sem tela (Baileys) | Existe, tem Dockerfile próprio; não auditado a fundo nesta rodada |

## P0 — bloqueia confiar no sistema como está

### 1. Controle de acesso por módulo ausente em 4 módulos Go

Confirmado por leitura direta do código: `identidade.TemAcesso(sess, identidade.ModuloX)` só
aparece nos handlers de Financeiro, Programação e Compras, além do hub da identidade. Nos
quatro módulos restantes, o piso de toda rota é só
`Sessoes.ExigirSessao` (+ `PodeLancar`/`PodeAprovar` para escrita):

- `internal/handlers/painel/handlers.go:47-57`
- `internal/handlers/estoque/handlers.go:57-67`
- `internal/handlers/rh/handlers.go:72-90`
- `internal/handlers/alojamentos/alojamentos.go` (`sessao()` só chama `ExigirSessao`)

`cmd/servidor/main.go` monta as rotas com `mux.HandleFunc` puro — não há middleware de
gate por módulo em lugar nenhum; os únicos usos de `dominioIdentidade.ModuloPainel/ModuloRH/
ModuloEstoque` em `main.go` (linhas 74-76) são para montar URL de tile do hub, não para
bloquear acesso.

**Efeito prático**: qualquer pessoa logada — inclusive cargo `CONSULTA` de um módulo qualquer
— hoje lê (e, dependendo do cargo, edita) Painel de Locação, Almoxarifado, RH e
Alojamentos inteiros, mesmo que o Portal nunca tenha liberado esses módulos pra ela. O cargo
ainda bloqueia escrita indevida (`PodeLancar`/`PodeAprovar`), mas não bloqueia leitura — alguém
do RH consegue ver toda a operação financeira do Painel de Locação, por exemplo.

**Por que é P0 e não só mais um item de backlog**: é o tipo de falha que não aparece testando
o caminho feliz (a pessoa que testa geralmente é ADMIN, que sempre vê tudo por regra —
`identidade.TemAcesso` linha 126). Só aparece com um usuário de cargo/módulo limitado, que é
exatamente o cenário que a permissão existe pra cobrir.

**Correção é mecânica e barata**: os dois módulos que já fazem certo (`financeiro.go`,
`programacao.go`) têm o mesmo padrão de 8 linhas — um `sessao()` que chama `ExigirSessao` e
depois `identidade.TemAcesso(*s, identidade.ModuloX)`. É copiar esse padrão pros outros 4
handlers. Não precisa desenhar nada novo.

### 2. Duas migrations `0010`

`migracao-go/internal/infrastructure/database/migrations/` tem `0010_financeiro_controles.sql`
e `0010_programacao.sql`, conteúdo diferente, mesmo prefixo. O runner aplica em ordem
alfabética pelo nome completo do arquivo, então as duas rodam sem conflito hoje — mas é uma
pegadinha pronta pra quem criar a próxima migration sem perceber a colisão. Renomear uma pra
`0011` antes que isso aconteça.

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

### 4. CI cobre bem o Go, cobre pela metade os testes de referência que sustentam a migração

`.github/workflows/ci.yml`: o job Go roda `gofmt -l .`, `go vet ./...` e `go test ./...` com
cobertura — sólido. Os jobs Node descobrem os 8 apps automaticamente e rodam lint/typecheck/
build. Mas o E2E/Playwright — que é literalmente o mecanismo que este projeto usa para provar
"o Go faz o mesmo que o Next.js antes de desligar o Next.js" (README, seção "Como os testes de
referência funcionam") — só roda pra **3 dos 8 apps** (Frota, Portal, Painel de Locação),
mesmo RH, Estoque, Programação e Alojamentos tendo suítes `e2e/*.spec.ts` no repositório. E
mesmo esses 3 só rodam em push pra `main` ou disparo manual — nunca em PR, então uma quebra só
aparece depois de já estar em `main`. Some a isso que `docs/WORKFLOW_CI.md` admite que o
workflow **nunca rodou de verdade num runner do GitHub** — é só testado localmente até agora.

### 5. `docker-compose.yml` não tem serviço nenhum pro binário Go

O compose sobe os 8 apps Next.js + nginx, mas não sobe `migracao-go` — apesar de ser,
segundo o próprio README, "o núcleo do sistema" pro qual tudo está migrando. Hoje não existe
um jeito documentado/scriptado de colocar o binário Go no ar junto do resto em produção; só
`scripts/iniciar-projeto.ps1`, que é orquestração de desenvolvimento local, não deploy.

### 6. Documentação principal atualizada em 2026-08-11

Os dois READMEs agora registram Alojamentos, Compras, Financeiro e Programação Diária sem
ocultar as suítes Playwright e os cortes de legado que continuam pendentes.

Como este projeto trata `COMPORTAMENTO.md`/README como parte do processo (é o documento que
vira suíte de teste de referência), deixar esses dois desatualizados quebra o próprio método
que o time adotou.

### 7. Teste automatizado: forte na aplicação, quase ausente no handler

Nenhum pacote `internal/handlers/{painel,estoque,rh,alojamentos,compras,programacao}` tem
arquivo de teste — só `handlers/financeiro` e `handlers/identidade`. Na camada de aplicação a
cobertura é parcial: `painel/{dashboard,fornecedores,locacoes,obras}.go`,
`estoque/{materiais,solicitacoes,configuracao_email,limites,numero,dashboard}.go` e a maior
parte de `rh/*.go` não têm teste dedicado. Isso importa duas vezes aqui: primeiro porque é
teste faltando; segundo porque significa que **nenhum teste teria pego o item 1** (controle de
acesso ausente), e nenhum vai travar uma regressão depois que for corrigido, a menos que
alguém escreva teste de handler junto da correção.

### 8. Nenhuma listagem do binário Go pagina

Confirmado em Painel (`LocacaoRepositorio.Listar`), Almoxarifado (`MaterialRepositorio.Listar`,
`SolicitacaoRepositorio.Listar` sem filtro nenhum) e RH (`FuncionarioRepositorio.Listar`,
`CargoRepositorio.Listar`, `DepartamentoRepositorio.Listar`) — mesmo padrão já documentado
para Financeiro/Compras no outro briefing. Funciona hoje porque o volume de dados ainda é
pequeno; não escala.

## P2 — observações menores, não bloqueiam nada hoje

- **Segredos de desenvolvimento hardcoded**: `scripts/iniciar-projeto.ps1` tem dois fallbacks
  fixos (`AUTH_SECRET` na linha 11, `FROTA_AUTH_SECRET` na linha 12). Não são segredos de
  produção vazados — são valores de conveniência pra rodar local sem `.env` — mas merecem um
  comentário deixando isso explícito, porque um valor fixo em texto puro sempre levanta
  suspeita numa auditoria rápida.
- **Credencial padrão do seed** (`admin@siqueiracampos.com.br` / `locacao2026`) está
  documentada em texto puro em vários lugares (`docs/deploy.md`, `cmd/seed/main.go`, scripts de
  e2e). Esperado pra um seed de desenvolvimento — só reforça que trocar essa senha é passo
  obrigatório de qualquer deploy real, o que `docs/deploy.md` já menciona.
- Nenhum segredo real, chave de API ou `.env` de verdade encontrado versionado — a higiene de
  `.gitignore` está correta em todos os apps.
- **WhatsApp** (`apps/whatsapp`) e **Frota** não foram auditados a fundo nesta rodada — ambos
  fora do escopo direto da migração Go, mas valem uma passada futura.

## Ordem de ataque recomendada

1. **Controle de acesso por módulo** nos 5 handlers que faltam — maior risco, menor esforço,
   correção mecânica.
2. Renomear a migration `0010` duplicada — trivial, evita confusão futura.
3. Decidir (não necessariamente implementar já) se o binário Go adota o HUD superior novo ou
   se os apps Next.js voltam à sidebar — hoje o ERP tem os dois modelos coexistindo, e quanto
   mais tempo passar, mais módulos vão nascer no padrão "errado".
4. Ligar Playwright de RH/Estoque/Programação/Alojamentos no CI, e mover E2E pra rodar em PR,
   não só em `main`.
5. Manter os dois READMEs sincronizados com cada corte de legado.
6. Adicionar `migracao-go` ao `docker-compose.yml` quando o deploy real for planejado.
7. Teste de handler + paginação entram como trabalho de fundo, não bloqueiam nada imediato.

Itens específicos de Financeiro (perfis de tesouraria, conciliação bancária, rateio/categoria)
e Compras (casca visual, devolução sem estorno, contrato recorrente sem job) continuam
priorizados em
[`migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md`](migracao-go/BRIEFING_FINANCEIRO_COMPRAS.md) —
não repetidos aqui.
