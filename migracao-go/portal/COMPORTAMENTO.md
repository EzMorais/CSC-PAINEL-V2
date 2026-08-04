# Portal — comportamento atual (linha de base para a migração)

Mapeado em 2026-08-04 a partir do código-fonte de `apps/portal` (Next.js 16 + Prisma +
SQLite). Este documento é a especificação de comportamento que os testes em `apps/portal/e2e/`
codificam e que a futura implementação em Go deve igualar antes de o Next.js ser desligado —
ver `migracao-go/README.md` para o processo (Strangler Fig, TDD).

Não é um resumo do código — é o comportamento observável, incluindo os porquês que não
aparecem batendo o olho na tela.

## 1. Rotas

| Rota | Método | Protegida? | Descrição |
|---|---|---|---|
| `/entrar` | GET | não (redireciona pra `/` se já logado) | formulário de login |
| `/entrar` (server action `entrar`) | POST via form | não | autentica e cria sessão |
| `/` | GET | sim (sessão) | hub: sistemas liberados/bloqueados + resumo do que o cargo permite |
| `/usuarios` | GET | sim (sessão + ADMIN) | lista de usuários, criação, últimos acessos |

Não existem rotas de API (`route.ts`) nem `middleware.ts`. A proteção acontece em dois
lugares: `(app)/layout.tsx` chama `lerSessao()` e redireciona pra `/entrar` se não houver
sessão (cobre toda página dentro do grupo `(app)`); cada Server Action chama `exigirSessao()`
ou `exigirAdmin()` por conta própria, porque layouts não rodam para actions.

## 2. Autenticação — o mecanismo que os outros 4 apps dependem

Isto é a parte mais sensível de toda a migração: os outros 4 sistemas (Painel, RH,
Almoxarifado, Alojamentos) **leem o mesmo cookie**, sem consultar o banco do Portal. Qualquer
divergência aqui quebra o login único nos outros quatro, não só neste módulo.

- **Cookie**: nome `locacao_sessao`, `httpOnly`, `sameSite=lax`, `path=/`,
  `secure` só quando `NODE_ENV=production` E `FORCA_HTTPS=1` (o sistema roda em rede local por
  HTTP), `maxAge` de 7 dias.
- **Token**: JWT assinado com `HS256`, segredo = variável de ambiente `AUTH_SECRET`
  (**precisa ter o mesmo valor nos 5 apps** — é isso que faz a sessão valer entre eles;
  cookie não separa por porta, só por host). `AUTH_SECRET` com menos de 32 caracteres
  faz o processo falhar ao iniciar (validação em `segredo()`).
- **Claims do token**: `{ id, nome, email, cargo, modulos: string[], papel }`. `papel` é uma
  cópia de `cargo` mantida só porque módulos ainda não migrados para o campo novo podem lê-la
  — remover quebraria esses módulos silenciosamente (o usuário pareceria logado, mas sem
  nenhuma permissão). Ao ler o token, `cargo` e `papel` se preenchem um a partir do outro se
  um dos dois faltar, com fallback final para `CONSULTA`.
- **Expiração**: 7 dias, calculada no momento da emissão (`setIssuedAt` + `setExpirationTime`).
- **Verificação nunca lança**: assinatura inválida, token expirado ou adulterado — qualquer um
  desses casos vira `null` (não autenticado), nunca uma exceção que vaze detalhe pro chamador.
- **Mudança de cargo só vale no próximo login.** Não existe invalidação de sessão ativa: o
  cargo viaja dentro do token, não é consultado no banco a cada requisição. É a decisão que
  permite os outros módulos validarem sessão mesmo com o Portal fora do ar. A tela de usuários
  avisa isso explicitamente ao admin depois de salvar.

### 2.1 Defesa contra enumeração de e-mail (timing + mensagem)

`autenticar(email, senha)`:
1. Busca o usuário pelo e-mail (case-insensitive, trim).
2. **Roda `bcrypt.compare()` mesmo se o usuário não existir**, comparando contra um hash bcrypt
   válido fixo (`HASH_ISCA`) descartável. Sem isso, a ausência da comparação seria uma
   diferença de tempo mensurável que denuncia quais e-mails têm conta — mesmo sem revelar
   senha nenhuma.
3. Se usuário não existe, está inativo, ou a senha não confere: grava uma tentativa falha em
   `RegistroAcesso` com um `motivo` específico (`'e-mail não cadastrado'` |
   `'usuário inativo'` | `'senha incorreta'`) — **mas a Server Action (`actions/auth.ts`)
   devolve a mesma mensagem genérica pros três casos**: `"E-mail ou senha não conferem."`. O
   `motivo` granular só aparece depois, pro admin, na lista de últimos acessos — nunca pra
   quem está tentando entrar.
4. Login bem-sucedido: grava `RegistroAcesso` de sucesso e atualiza `ultimoAcesso`.
5. Gravar o registro de acesso **nunca derruba o login** — está em `try/catch` que engole o
   erro; falhar em auditar não é motivo pra recusar quem tem senha certa.

### 2.2 Redirecionamento pós-login (proteção contra open redirect)

O campo `destino` vem escondido no formulário (preenchido pela página de login a partir de
`?destino=` na URL) e só é aceito se começar com `/` e não começar com `//` — um endereço
completo (`https://site-malicioso/…`) ou um `//` (interpretado como protocolo-relativo por
alguns navegadores) cairia no padrão `/` em vez de ser seguido. Existe pra alguém poder
compartilhar um link direto pra um módulo que devolve pro login com o destino certo, sem abrir
brecha pra phishing.

### 2.3 `exigirSessao()` / `exigirAdmin()` — nota de implementação que importa pro Go

`redirect()` do Next interrompe a execução lançando um sinal interno — por isso toda chamada a
`exigirSessao()`/`exigirAdmin()` fica **fora** do `try/catch` de cada Server Action: um catch
genérico ali engoliria o redirecionamento e devolveria `{ ok: false }` em vez de mandar a
pessoa pro login. Equivalente em Go: checar a sessão e responder com o redirect (302) **antes**
de entrar em qualquer bloco que trate erro de negócio como resposta genérica.

## 3. Cargos e módulos (`lib/dominio/cargos.ts`)

5 cargos fixos, nesta ordem (a ordem importa pros `<select>` da UI):
`ADMIN`, `DIRETORIA`, `GERENTE`, `OPERACIONAL`, `CONSULTA`.

5 módulos fixos: `PAINEL`, `RH`, `ESTOQUE`, `ALOJAMENTOS`, `FROTA`.

| Predicado | ADMIN | DIRETORIA | GERENTE | OPERACIONAL | CONSULTA |
|---|---|---|---|---|---|
| `podeLancar` (cria/edita/movimenta) | ✓ | | ✓ | ✓ | |
| `podeAprovar` (aprova o que outro lançou) | ✓ | ✓ | ✓ | | |
| `podeAdministrar` (usuários/config) | ✓ | | | | |
| `podeVer` | ✓ | ✓ | ✓ | ✓ | ✓ |

`podeAprovar` exclui `OPERACIONAL` de propósito — é a separação que faz a aprovação valer
alguma coisa ("quem lança não aprova").

`temAcesso(sessao, modulo)`: `ADMIN` e `DIRETORIA` sempre têm acesso a todos os módulos,
**independente do que está gravado em `AcessoModulo`** — não é preciso (e a UI não deixa)
marcar módulo pra esses dois cargos. Os outros três cargos dependem da lista de
`AcessoModulo` do usuário.

URLs dos módulos vêm de variáveis de ambiente (`NEXT_PUBLIC_URL_*`), com defaults
`localhost:3000` (Frota) `:3001` (Painel) `:3002` (RH) `:3003` (Almoxarifado) `:3005`
(Alojamentos) — o próprio Portal fica em `:3004`.

## 4. Modelo de dados

```
Usuario
  id            TEXT PK (cuid)
  nome          TEXT NOT NULL
  email         TEXT NOT NULL UNIQUE
  senhaHash     TEXT NOT NULL        -- bcrypt, custo 10
  cargo         TEXT NOT NULL DEFAULT 'OPERACIONAL'
  ativo         BOOLEAN NOT NULL DEFAULT true
  telefone      TEXT NULL
  observacao    TEXT NULL
  criadoEm      DATETIME NOT NULL DEFAULT now
  atualizadoEm  DATETIME NOT NULL    -- auto-atualizado a cada UPDATE
  ultimoAcesso  DATETIME NULL
  INDEX (cargo)

AcessoModulo
  id         TEXT PK (cuid)
  modulo     TEXT NOT NULL
  usuarioId  TEXT NOT NULL FK -> Usuario.id ON DELETE CASCADE
  UNIQUE (usuarioId, modulo)
  INDEX (modulo)

RegistroAcesso
  id        TEXT PK (cuid)
  email     TEXT NOT NULL   -- texto solto, NÃO é FK — sobrevive à exclusão do usuário
  nome      TEXT NULL
  sucesso   BOOLEAN NOT NULL
  motivo    TEXT NULL
  ocorrido  DATETIME NOT NULL DEFAULT now
  INDEX (ocorrido)
  INDEX (email)
```

`RegistroAcesso.email` é texto solto e não uma relação de propósito: o registro precisa
sobreviver à exclusão do usuário — é justamente quando alguém é removido que a pergunta "quem
tentou entrar como fulano" costuma aparecer.

## 5. Regras de negócio — Server Actions (`actions/usuarios.ts`)

Todas exigem `exigirAdmin()` primeiro (fora de qualquer try/catch, ver §2.3).

**`criarUsuario`**: valida via schema (nome ≥3 chars, e-mail válido, senha ≥8, cargo em enum,
telefone/observação opcionais, módulos array de enum default `[]`). E-mail duplicado → erro
amigável `"Já existe um usuário com esse e-mail."` (não vaza a mensagem crua do Prisma).
Grava `senhaHash` com bcrypt custo 10. Cria os `AcessoModulo` junto, numa única chamada
(`create` aninhado).

**`editarUsuario(id, entrada)`**: **bloqueia autoedição** — se `id === admin.id`, devolve erro
`"Você não pode mudar o próprio cargo nem se desativar. Peça a outro administrador."` sem
tocar no banco. Sem essa trava, um admin distraído se rebaixa e ninguém mais consegue desfazer
sem mexer direto no banco. Fora esse caso: atualiza `cargo`/`ativo`, apaga todos os
`AcessoModulo` do usuário e recria a partir da lista nova — **numa transação só**
(`prisma.$transaction([...])`), porque se apagar der certo e criar falhar no meio, a pessoa
ficaria sem nenhum módulo sem ninguém ter pedido isso.

**`redefinirSenha(id, entrada)`**: valida senha ≥8, grava novo hash bcrypt custo 10. Sem
trava de autoedição (um admin pode trocar a própria senha).

Toda mutação bem-sucedida chama `revalidarTelas('/usuarios')` — invalida o cache do Next pra
tela de usuários refletir a mudança sem precisar de reload manual. Não tem equivalente
necessário no Go (SSR sem cache de página por padrão), mas o *momento* em que a lista precisa
recarregar continua o mesmo.

## 6. Comportamento de UI que os testes verificam

- **Login**: mensagem de erro única e genérica pra qualquer falha (ver §2.1); campo e-mail com
  autofoco; erro tem `role="alert"` e `data-testid="erro-login"`.
- **Hub (`/`)**: só lista módulos liberados (`temAcesso`); módulos bloqueados aparecem numa
  seção separada com cadeado — **de propósito, não escondidos**, pra quem não tem acesso saber
  o que pedir em vez de nem saber que o sistema existe.
- **`/usuarios`**: acessível só a `ADMIN` — outro cargo que tentar entrar é redirecionado pra
  `/` (via `exigirAdmin()`). Formulário de criação: campo de módulos some (substituído por
  texto explicativo) quando o cargo escolhido é `ADMIN` ou `DIRETORIA`, já que esses ignoram a
  lista. Edição de usuário: o próprio botão "Editar" fica `disabled` pro admin logado
  (`souEu`), além do bloqueio no servidor — é defesa em duas camadas, não uma alternativa à
  outra. "Últimos acessos" mostra sucessos e falhas, com o motivo específico só nas falhas.

## 7. Seed / bootstrap (`prisma/seed.ts`)

- Cria o admin `admin@siqueiracampos.com.br` só se ainda não existir (`create` guardado por
  `findUnique`, nunca `upsert` — rodar o seed de novo não pode devolver a senha padrão a uma
  conta cuja senha já foi trocada). Senha vem de `SENHA_ADMIN` ou usa `locacao2026`.
- Cria 5 contas de exemplo (uma por cargo/combinação de módulo), todas com senha
  `exemplo2026` e uma `observacao` avisando que são demonstração.

## 8. O que fica fora do escopo do Portal (não reimplementar aqui)

O Portal **emite** a sessão; ele não sabe nada sobre o que Painel, RH, Almoxarifado, Alojamentos
ou Frota fazem com ela além de ler `cargo`/`modulos` do token. As regras de negócio de cada um
desses módulos (regras de locação, EPI, aprovação de compra, etc.) são objeto de documentos
próprios quando a migração chegar neles — não duplicar aqui.
