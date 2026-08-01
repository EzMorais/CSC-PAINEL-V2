# Task 15 — Painel, drawer de detalhe e histórico

Branch `task15-drawer`, commit `7817c5a`. Working tree limpo.

## Arquivos criados

- `src/actions/locacoes.ts` — `carregarLocacao`, `criarLocacao`, `editarLocacao`,
  `renovarLocacao`, `devolverLocacao`, `transferirLocacao`, `reclassificarEmLote`.
- `src/components/locacoes/drawer-locacao.tsx` — abas Dados e Histórico.
- `src/components/locacoes/painel-locacoes.tsx` — costura tabela + drawer + ações.

Nada mais foi tocado. `src/app/locacoes/page.tsx`, `tabela-locacoes.tsx`, `filtros.tsx`,
`src/queries/locacoes.ts` e os módulos de `src/lib/dominio/` foram importados, não alterados.

## Estado do banco após o setup (confere com o esperado)

```
$ sqlite3 prisma/dev.db "..."
locacoes|305    devolvidas|63    perdidas|16
aConfirmar|110  duplicata|110    obras|11   fornecedores|22
```

`confirmarImportacao` retornou `{ ok: true, dados: { criadas: 305, puladas: 0, fornecedoresCriados: 0 } }`.
O banco foi restaurado a esse estado exato depois das verificações (as duas locações
que exercitei estão desfeitas).

## Verificação 1 — actions por script, contra os dados reais

`npx tsx --env-file=.env scripts/_verif15.mts` (script temporário, apagado).
Alvo: `cms9rawdp00bs8ocagc7yn3ur` — DIAGONAL TUBULAR 1 X 1,5 METROS,
início 2026-06-13, fim 2026-07-13.

```
== renovarLocacao(id, 15)
{"ok":false,"erro":"Invariant: static generation store missing in revalidatePath /"}
== devolverLocacao(id, 2026-07-31)
{"ok":false,"erro":"Invariant: static generation store missing in revalidatePath /"}
== devolverLocacao de novo (deve falhar com erro explícito)
{"ok":false,"erro":"Locação já devolvida."}
== renovarLocacao após devolução (deve falhar)
{"ok":false,"erro":"Locação já devolvida — não pode ser renovada."}
```

**Ressalva reportada, não maquiada:** as duas primeiras chamadas devolveram `ok:false`.
A causa não é a lógica de negócio — a escrita no banco foi feita. É `revalidatePath`, que
lança fora de um request do Next; a chamada está dentro do `try`, então o `catch` converte
um sucesso de escrita em `ok:false`. Isso só acontece ao invocar a action de um script
avulso. A verificação 2 abaixo roda as mesmas actions dentro do runtime real e as duas
retornam `ok:true`. O comportamento é o do brief; não alterei o posicionamento do
`revalidar()` por conta própria.

Estado no banco depois (`sqlite3`):

```
id                         descricao                        dataInicio     dataFim        devolvidaEm
cms9rawdp00bs8ocagc7yn3ur  DIAGONAL TUBULAR 1 X 1,5 METROS  1781308800000  1785196800000  1785456000000
                                                            = 2026-06-13   = 2026-07-28   = 2026-07-31

IMPORTACAO  Importado da aba SC-1135-25A, linha 24
RENOVACAO   Renovada por 15 dias — novo fim 28/07/2026
DEVOLUCAO   Devolvida em 31/07/2026 — permaneceu 48 dias na obra · verificação task 15

locacoes|305   movimentacoes|307
```

O que isso prova: a linha **continua existindo** (305, sem variação), `dataInicio`
continua 2026-06-13 (não foi sobrescrita pela data de devolução, que é o que o app
Tkinter fazia), e a movimentação registra os 48 dias reais na obra.

## Verificação 2 — mesmas actions dentro do runtime do Next (porta 3015)

Route handler temporário em `/api/v15`, apagado depois. Alvo ESCADA TUBULAR 2 METROS,
início 2026-06-13, fim 2026-07-13:

```json
"renovacao": { "ok": true, "dados": { "novaData": "2026-07-23T00:00:00.000Z" } },
"devolucao": { "ok": true },
"depois": { "dataInicio": "2026-06-13T00:00:00.000Z",
            "dataFim":    "2026-07-23T00:00:00.000Z",
            "devolvidaEm":"2026-07-31T00:00:00.000Z",
            "movimentacoes": [ IMPORTACAO, RENOVACAO (payloadAntes/Depois preenchidos),
                               DEVOLUCAO "permaneceu 48 dias na obra" ] }
```

## Verificação 3 — navegador, porta 3015, dados reais (Playwright)

`GET /locacoes` → HTTP 200, `data-testid="contagem"` = 240 itens; 240 linhas na tabela.

Clicando no equipamento a tabela abre o drawer, com as duas abas:

```
título: Ar Condicionado 10.000 BTUs
aba 0: "Dados"          aria-selected=true
aba 1: "Histórico (1)"  aria-selected=false
histórico: Importado da aba SC-1017-26_TOYOTA, linha 34 | importacao · 01/08/2026
```

O histórico já traz a movimentação de importação, como pedido.

Cores de status — li a cor computada no navegador para confirmar que a forma nomeada
aplica de fato (nenhuma herda o foreground):

| item | classe | `getComputedStyle().color` |
|---|---|---|
| GUARDA CORPO (vencida há 18 dias) | `text-status-vencida` | `lab(49.2966 62.8465 43.054)` — vermelho |
| DIAGONAL TUBULAR MISTA (vence em 8 dias) | `text-status-ativa` | `lab(57.9142 -48.5439 32.2804)` — verde |
| DIAGONAL TUBULAR 1 X 1,5 (devolvida) | `text-status-devolvida` | `lab(47.7271 -0.879407 -7.38947)` |

Outras conferências na tela, todas passando:

- Deep-link `?item=<id>` abre o drawer direto (`itemInicial`).
- Drawer da locação devolvida: rodapé de ações **ausente** (`footer` count = 0) e o
  histórico completo em ordem decrescente — devolução (48 dias na obra) → renovação →
  importação.
- `?aConfirmar=1` → 110 itens, e o drawer exibe o aviso "Obra a confirmar: este item veio
  de uma aba compartilhada por mais de uma obra."
- `Escape` fecha o drawer.
- Zero erros de console e zero `pageerror` em todas as passagens.

## tsc e lint

```
$ npx tsc --noEmit
src/components/locacoes/painel-locacoes.tsx(7,39): error TS2307: Cannot find module './dialog-acao'
src/components/locacoes/painel-locacoes.tsx(8,27): error TS2307: Cannot find module './acoes-lote'
```

Sobram exatamente esses dois, ambos da Task 16 — sem stubs, sem imports contornados.
O erro de `painel-locacoes` que existia antes em `src/app/locacoes/page.tsx` sumiu.

```
$ npm run lint
✖ 2 problems (0 errors, 2 warnings)
```

Zero erros. Os dois warnings são pré-existentes, em `scripts/verificar-planilha.ts` e
`src/actions/importar.ts`, arquivos que não toquei.

## Desvio consciente do código do brief (um só)

O `useEffect` do drawer no brief chama `setDetalhe`/`setAba` de forma síncrona no corpo do
efeito, e a regra `react-hooks/set-state-in-effect` **reprova isso como erro**, não warning
— o lint não passaria. Troquei pelo padrão oficial de estado derivado de prop (ajuste
durante o render, comparando `id` com o `idExibido` anterior), e o carregamento assíncrono
ficou no efeito com guarda de corrida (`vivo`). Comportamento visível idêntico, com um
ganho: zerar durante o render evita pintar um quadro com o detalhe do item anterior sob o
cabeçalho do novo.

Também usei `type="button"` explícito nos botões e um `<span>` com a classe nomeada de cor
na linha "Situação".

## Arquivos temporários — todos removidos

`scripts/_pop.mts`, `scripts/_verif15.mts`, `src/app/api/v15/route.ts`, os placeholders de
`dialog-acao.tsx`/`acoes-lote.tsx` usados só para o servidor compilar durante a verificação
do navegador, os scripts Playwright e os PNGs. `git status` limpo depois do commit; o
commit contém apenas os três arquivos da tarefa.
