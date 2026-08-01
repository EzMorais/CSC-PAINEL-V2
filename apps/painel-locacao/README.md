# Painel de Locação — Construtora Siqueira Campos

Controle de equipamentos locados por obra. Substitui um app em Tkinter que usava uma
planilha Excel como banco de dados.

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 6 + SQLite · Tailwind v4 · Playwright

---

## Rodar em 5 minutos

Precisa de **Node 20+** e nada mais. Não há serviço externo, conta em nuvem nem chave de API.

```bash
git clone <url-do-repositório>
cd siqueiracampos-painellocacao

npm install
printf 'DATABASE_URL="file:./dev.db"\n' > .env   # obrigatório: sem ele o Prisma não sobe
# segredo que assina o cookie de sessão — precisa ter 32+ caracteres
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
npx prisma migrate deploy                        # cria o banco
npm run db:seed                                  # cadastra obras, fornecedores e o usuário admin
npm run gerar:exemplo                            # gera uma planilha de teste
npm run dev
```

Abra <http://localhost:3000>. Ele pede login:

| | |
|---|---|
| **Usuário** | `admin@siqueiracampos.com.br` |
| **Senha** | `locacao2026` |

Troque a senha depois do primeiro acesso. Para começar com outra, rode o seed com
`SENHA_ADMIN="a-que-voce-quiser" npm run db:seed`.

Depois de entrar, o painel aparece **sem nenhuma locação** — isso é esperado.
Vá em **Importar**, envie o arquivo `dados/EXEMPLO_Maquinas_Alugadas.xlsx` que o passo
anterior gerou, confira a prévia e confirme. Devem entrar **68 locações**.

O caminho `file:./dev.db` é resolvido a partir de `prisma/`, então o banco nasce em
`prisma/dev.db`. Para usar outra porta: `npm run dev -- --port 3024`.

Se algo não bater, `npm run verificar:planilha` mostra onde.

---

## Passo a passo com o Claude Code

Se preferir que o Claude conduza, abra o Claude Code na pasta do projeto e cole isto:

> Li o README deste projeto. Prepare o ambiente e me mostre o sistema rodando:
>
> 1. Rode `npm install`, crie o `.env` com `DATABASE_URL="file:./dev.db"`, aplique as
>    migrations com `npx prisma migrate deploy` e rode `npm run db:seed`.
> 2. Gere a planilha de exemplo com `npm run gerar:exemplo`.
> 3. Suba o servidor, importe essa planilha pela tela `/importar` e confirme que entraram
>    68 locações — 53 ativas e 15 devolvidas.
> 4. Rode `npm run typecheck`, `npm run lint` e `npm run test:e2e`. Me diga o resultado
>    real de cada um; se algo falhar, me mostre a saída em vez de contornar.
> 5. Me explique o que são os itens marcados como "obra a confirmar" e como
>    "possível duplicata", que vou ver na listagem.
>
> Regras: não altere lógica de negócio nem número esperado para fazer algo passar. Se um
> número divergir do que o README diz, me avise em vez de ajustar o código.

Depois, para explorar o sistema:

> Me mostre, consultando o banco: quantas locações estão vencidas, quantas vencem nos
> próximos 7 dias, e quais equipamentos estão marcados como perdidos. Compare esses
> números com o que o dashboard exibe e me diga se batem.

### Subir no seu próprio GitHub

```bash
# Se você clonou deste repositório, aponte para o seu antes de enviar:
git remote remove origin
gh repo create <nome-do-seu-repo> --private --source=. --remote=origin --push
```

Ou peça ao Claude:

> Crie um repositório **privado** no meu GitHub com este projeto e faça o push.
> Antes de enviar, confirme que nenhum arquivo `.xlsx`, `.db` ou `.env` está sendo
> versionado — nem no working tree, nem em commit nenhum do histórico.

Privado é a recomendação: mesmo com os dados fora do Git, o repositório descreve a operação
de uma empresa real.

---

## Dados: o que está aqui e o que não está

**Nunca sobem para o Git:** o banco (`prisma/*.db`), as planilhas (`dados/`), os arquivos
exportados e o `.env`. São dados financeiros de obra.

**Os dados de exemplo são fictícios.** `prisma/dados-exemplo.ts` traz 3 clientes, 6 obras e
8 fornecedores inventados. Nomes de clientes reais, telefones de fornecedores e nomes de
funcionários ficam em `prisma/dados-locais.json`, que é git-ignored.

Para usar os dados da sua empresa, crie esse arquivo assim:

```json
{
  "obras": [
    { "cliente": "CLIENTE", "codigo": "OBRA-001", "descricao": "Descrição da obra",
      "responsavel": "nome", "abaOrigem": "NOME_DA_ABA_NA_PLANILHA" }
  ],
  "fornecedores": [
    { "nome": "FORNECEDOR LTDA", "telefone": "(11) 90000-0000",
      "aliases": ["FORNECEDOR", "FORNEC"] }
  ]
}
```

O seed usa esse arquivo quando existe e cai nos dados de exemplo quando não existe. O campo
`abaOrigem` diz de qual aba da planilha a obra vem — é o que o importador usa para saber
onde cada item entra. Duas obras podem apontar para a mesma aba: nesse caso o sistema marca
os itens como "obra a confirmar".

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run typecheck` | Confere os tipos |
| `npm run lint` | Confere o estilo |
| `npm run db:seed` | Cadastra obras e fornecedores |
| `npm run db:reset` | Apaga o banco e recadastra do zero |
| `npm run gerar:exemplo` | Gera uma planilha de teste em `dados/` |
| `npm run verificar:planilha` | Confere o leitor contra a planilha |
| `npm run verificar:status` | Confere o cálculo de vencimento |
| `npm run verificar:periodo` | Confere período e valor total |
| `npm run verificar:coluna15` | Confere a classificação da coluna 15 |
| `npm run test:e2e` | Playwright: 91 testes em 3 tamanhos de tela |

> `db:reset` usa `prisma migrate reset`, que **apaga tudo**. O Prisma bloqueia esse comando
> quando detecta um agente de IA executando, então o Claude não consegue rodá-lo por você —
> rode à mão se precisar.

---

## Como o sistema funciona

O banco SQLite é a fonte da verdade. O Excel entra pelo importador e sai pelo exportador;
não é mais editado à mão.

**Status não é campo gravado.** É calculado a partir de `dataFim` e `devolvidaEm` toda vez
que a tela monta. Um item vence sozinho, sem ninguém atualizar nada. Gravar status criaria
uma segunda fonte de verdade que envelhece — o problema que a migração existe para resolver.

**Devolver não apaga.** A locação muda de status e ganha uma linha no histórico. A data de
início original sobrevive, e com ela a resposta para "quanto tempo esse equipamento ficou na
obra". O app antigo apagava a linha e recriava num bloco de devoluções, sobrescrevendo a data
de início — nas 63 devoluções da planilha original, início e fim são iguais porque essa
informação já tinha sido destruída.

**A sessão é checada em três lugares, e os três são necessários.** O layout de
`src/app/(app)/` cobre as páginas; cada Server Action chama `exigirSessao()`; e as rotas
`api/export/*` checam por conta própria. Não é redundância — layout do App Router não roda
para Server Action nem para rota de API. Confiar só nele deixaria os endpoints das actions
(que o Next expõe por um id estável) e o download da planilha inteira abertos a quem
chamasse o endereço direto, sem passar por tela nenhuma.

**Apelidos de fornecedor** existem porque a planilha escreve `KAISEN` onde o cadastro diz
`KAISEN LOCAÇÕES`. Sem eles cada grafia viraria um fornecedor diferente, e o gráfico de valor
por fornecedor mentiria.

**Datas são gravadas como meia-noite UTC representando um dia de calendário.** Por isso
existem duas funções de formatação, e confundi-las já causou dois bugs aqui:

- `dataBR` — datas armazenadas (banco, Excel). Formata em UTC.
- `dataLocalBR` — instantes reais, como o carimbo "emitido em" de um relatório.

Pelo mesmo motivo, filtros SQL usam `limiteEmDias` e não `startOfDay`: um limiar em
meia-noite local cai 3 horas depois no Brasil, e o filtro passa a discordar da etiqueta
exibida na tabela ao lado.

### Dois avisos que aparecem na tela

**Obra a confirmar.** A planilha de origem tem abas compartilhadas por mais de uma obra, e
não dá para saber a qual delas cada item pertence. Eles entram marcados, e a listagem tem
seleção múltipla para reclassificar em lote.

**Possível duplicata.** O mesmo equipamento aparece em abas diferentes. O campo `Tr` é número
de requisição e não identificador de equipamento — um mesmo `Tr` cobre vários itens —, então
é impossível distinguir automaticamente erro de cópia de remessa dividida entre obras. O
sistema importa tudo e sinaliza, em vez de descartar: perder registro financeiro em silêncio
seria pior do que pedir uma conferência.

---

## Estrutura

```
prisma/
  schema.prisma          6 tabelas
  seed.ts                usa dados-locais.json se existir, senão os de exemplo
  dados-exemplo.ts       obras e fornecedores fictícios (versionado)

src/lib/dominio/         regras puras: status, período, formatação
src/lib/planilha/        leitura e escrita de Excel, e o PDF
src/lib/auth.ts          sessão em cookie assinado (JWT) e senha com bcrypt
src/queries/             leituras (Server Components)
src/actions/             escritas (Server Actions) — retornam { ok } ou { ok:false, erro }
src/components/          interface
src/app/entrar/          tela de login (única rota pública)
src/app/(app)/           tudo que exige sessão — o layout do grupo faz a checagem

e2e/                     Playwright: autenticação, importação, ciclo de vida, responsividade
scripts/                 verificações de regra e gerador de planilha de exemplo
```

As regras de negócio ficam em `src/lib/dominio/`, fora do React e do Prisma. Cada uma tem um
script `verificar-*.ts` que roda em segundos e imprime números conferíveis — é o que
substitui testes unitários aqui, por decisão de escopo.

---

## Limitações conhecidas

- **O login é simples, e o sistema continua desenhado para rodar local.** Há sessão em
  cookie assinado e senha com bcrypt, e nada — página, Server Action ou rota de export —
  responde sem sessão. Mas não há 2FA, expiração por inatividade, bloqueio depois de N
  tentativas nem cadastro de usuários pela interface: o segundo usuário entra pelo banco.
  Antes de expor na internet, coloque HTTPS na frente (e então `FORCA_HTTPS=1` no `.env`,
  para o cookie sair marcado como `secure`).
- **Não funciona em serverless como está.** O SQLite grava em arquivo, e plataformas como a
  Vercel têm sistema de arquivos efêmero — as gravações se perderiam. Para hospedar, troque
  o `provider` do Prisma para `postgresql` e faça o upload da planilha ser processado em
  memória em vez de gravado em disco.
- **Busca sensível a maiúsculas em acentos.** Limitação do `LIKE` do SQLite. Como as
  descrições estão em caixa alta, não incomoda na prática; migrar para Postgres resolve.
- **Uploads se acumulam** em `dados/upload-*.xlsx` a cada importação, sem expurgo automático.
- Valores monetários usam ponto flutuante. O erro de arredondamento nesta ordem de grandeza é
  irrelevante para exibição; se entrar conciliação contábil, migre para centavos em `Int`.

---

## Documentação de projeto

- `docs/plans/2026-07-31-painel-locacao-design.md` — decisões de arquitetura e o que a
  análise da planilha original revelou sobre os dados
- `docs/plans/2026-07-31-painel-locacao-mvp*.md` — o plano de implementação em 24 tarefas
