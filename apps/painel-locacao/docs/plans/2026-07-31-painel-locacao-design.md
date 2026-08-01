# Painel de Locação SC — Design

**Data:** 2026-07-31
**Contexto:** migração do painel Tkinter/Python + Excel da Construtora Siqueira Campos para uma aplicação web.

## Problema

O sistema atual é um app Tkinter de arquivo único que lê e escreve uma planilha `.xlsx`
(`Maquinas_Alugadas_Controle_REVISADA.xlsx`, 9 abas). A planilha é o banco de dados: cada
obra é uma aba, cada locação é uma linha gravada por posição de coluna, e as regras de
negócio vivem como fórmulas Excel.

Inventário real na data do design: **242 locações ativas, 61 devolvidas, R$ 123.681,50** em
valor de item, 9 fornecedores distintos.

### Limitações estruturais

1. **Obras colidem em abas.** `OBRAS` mapeia 11 obras para 8 abas. As três obras TOYOTA
   (SC-1028-25, SC-1122-25, SC-1017-26) caem todas em `SC-1017-26_TOYOTA`; MORELLI 25B e 25C
   dividem `SC-1135-25B_MORELLI`. É impossível saber em qual obra um equipamento está, ou
   ratear custo por contrato.
2. **A coluna 15 acumula três campos.** O cabeçalho diz `UNIDADES`, mas o conteúdo real
   mistura quantidade (`1`, `8`, `2`, `4`, `10`), estado físico (`PERDIDO` ×12, `PERDIDA` ×4,
   `ok`/`OK` ×6) e texto livre (`TESTE ANDAIMES`, `CONTAINER`). O app grava observações nessa
   mesma coluna, sobrescrevendo controle de quantidade e de item perdido.
3. **Nomes de fornecedor divergem em três grafias.** Planilha: `KAISEN`, `BAN MAQ`, `GOULART`,
   `MIL MAQUINAS`, `3A ANDAIMES`. Dropdown do app: `KAISEN LOCACOES`, `BAN MAQ LOCACOES`,
   `GOULART CACAMBAS`, `COMERCIAL 3A`. Aba RESUMO: uma terceira. Cada registro novo cria um
   fornecedor fantasma nos KPIs. `ASSISTEC` e `DOIS IRMÃOS` existem nos dados e não constam
   do dropdown — ninguém consegue selecioná-los.
4. **Devolver destrói informação.** `retirar()` copia a linha para o bloco `DEVOLUÇÕES` e
   apaga a original. Nas 61 linhas devolvidas, início = fim: o tempo real de permanência do
   equipamento na obra não existe mais. O histórico sobrevive apenas como texto colado na
   coluna de observação (`"TRANSFERIDO PARA X em dd/mm"`).
5. **A aba RESUMO tem dados que o app ignora:** responsável por obra (nicolas, mariana,
   lucas, enzo, luana), cliente, descrição da obra e telefone de 20 fornecedores.
6. **16 itens perdidos são invisíveis.** Marcados na coluna 15, nunca somados em lugar nenhum.
7. **`Nº` não identifica nada** — repete entre abas e não é sequencial.
8. **Erros são mudos.** Cerca de 15 blocos `except:` sem tratamento: falha de gravação vira
   "nada aconteceu".

## Decisões

| Decisão | Escolha |
|---|---|
| Fonte da verdade | Banco de dados. Excel vira **saída**, não entrada |
| Infraestrutura | **Local + GitHub**, sem nuvem |
| Banco | **SQLite via Prisma** (troca para Postgres mudando `provider`) |
| Escopo MVP | Paridade com o Tkinter + importador + export xlsx/PDF + CRUD de obras e fornecedores |
| Obras TOYOTA/MORELLI | Importa na obra principal com selo "a confirmar"; reclassificação em lote pela UI |
| Coluna 15 | Separada em `quantidade`, `estado` e `observacoes` |
| Visual | Light por padrão + toggle dark |
| Testes | Playwright E2E dos fluxos críticos + responsividade em 3 viewports |

Sobre o visual: light-first é decisão prática, não estética — o painel é consultado no
celular em canteiro, sob sol, onde tela escura fica ilegível. O PDF sai do mesmo sistema de cor.

## Arquitetura

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma/SQLite · Tailwind · shadcn/ui ·
Recharts · Playwright.

Mutações via **Server Actions** — sem camada de API para escrever, o que remove metade do
código de um CRUD. Leituras em Server Components.

Considerado e descartado: Drizzle no lugar do Prisma (migrations e `seed` do Prisma são parte
do valor entregue no repositório); API REST separada (sem consumidor externo que a justifique).

### Modelo de dados

```
Obra                       Fornecedor                Locacao
├ cliente     TOYOTA       ├ nome      KAISEN        ├ obraId ────────┐
├ codigo      SC-1017-26   ├ telefone  15 99668…     ├ fornecedorId ──┘
├ descricao                ├ aliases[] ← normaliza   ├ descricao, trCodigo
├ responsavel lucas        └ ativo        o import   ├ quantidade   ┐ ex-coluna 15,
├ abaOrigem   (p/ export)                            ├ estado       │ agora
└ ativa                    Movimentacao              ├ observacoes  ┘ separados
                           ├ locacaoId               ├ dataInicio, dataFim
                           ├ tipo                    ├ valorItem
                           │   REGISTRO               ├ obraAConfirmar (bool)
                           │   RENOVACAO              └ status ← derivado
                           │   EDICAO                       ATIVA | ATENCAO
                           │   TRANSFERENCIA                VENCIDA | DEVOLVIDA
                           │   DEVOLUCAO
                           ├ payloadAntes / payloadDepois
                           └ criadoEm
```

Três consequências diretas:

- **Obra é entidade real.** As 11 obras existem separadas; TOYOTA deixa de ser um balaio.
- **Devolver muda o status, não apaga a linha.** A data de início sobrevive, e passa a ser
  possível saber quanto cada equipamento custou de fato por obra.
- **Status é derivado da data, nunca digitado.** A fórmula Excel `VENCIDA/ATENÇÃO/ATIVA` vira
  uma função TypeScript pura e testável.

`abaOrigem` existe só para o export reconstruir o arquivo no layout que a equipe conhece.

### Telas

```
/                Dashboard    5 KPIs · donut por fornecedor · barras por obra · vencimentos 7d
/locacoes        Lista        busca · filtros (obra/fornecedor/status/período) · lote
                              → drawer do item: [Dados] [Histórico]
                              → ações: Editar · Renovar · Devolver · Transferir
/locacoes/nova   Registrar    período rápido (Diário→Trimestre) preenche a data fim
/obras           CRUD         cliente · código · descrição · responsável
/fornecedores    CRUD         nome · telefone · aliases
/importar        Upload       .xlsx → preview do que entendeu → confirmar → grava
```

KPIs do dashboard: total em locação, itens ativos, vencem em 7 dias, vencidos e **itens
perdidos** — este último inexistente hoje.

A aba **Histórico** do drawer é o que a planilha nunca teve: "renovado +30d por X em 12/06",
"transferido de MORELLI G3 em 03/07", cada linha vinda de `Movimentacao`.

No mobile a tabela vira lista de cards e os filtros vão para um bottom sheet. O caso de uso
em campo é curto: *o que vence essa semana* e *onde está o martelete 20161*.

### Importador

O parser localiza o cabeçalho `Nº` dinamicamente — o layout varia (`SC-1135-25A` tem
cabeçalho na linha 8, as demais na linha 3) — e lê até encontrar `LEGENDA:`,
`◂ Voltar ao Resumo` ou `DEVOLUÇÕES`. O bloco `DEVOLUÇÕES` entra como locação com status
`DEVOLVIDA` e uma `Movimentacao` correspondente.

Classificação da coluna 15: numérico → `quantidade`; `PERDIDO`/`PERDIDA` → `estado = PERDIDO`;
`OK`/`ok` → `estado = OK`; qualquer outro texto → `observacoes`.

Fornecedores são resolvidos por `aliases[]`, de forma que `KAISEN`, `KAISEN LOCACOES` e
`KAISEN LOCAÇÕES` convirjam para um único registro. Telefones vêm da aba RESUMO.

A importação mostra **preview antes de gravar** e lista as linhas que não soube interpretar.
Nada de falha silenciosa: erro de importação é exibido, não engolido.

### Tratamento de erro

Os `except:` mudos do Python são substituídos por resultado explícito nas Server Actions:
toda mutação retorna sucesso ou mensagem de erro exibida ao usuário. Validação de entrada com
Zod no limite da action.

## Testes

```
e2e/
  importar.spec.ts    importa a planilha real → 242 ativos, 61 devolvidos, 16 perdidos
  ciclo-vida.spec.ts  registrar → renovar → transferir → devolver, conferindo o histórico
  responsivo.spec.ts  telas principais em 390 / 768 / 1440
```

Banco de teste isolado, recriado a cada execução.

## Fora do escopo

Autenticação e multiusuário (o sistema roda local). Notificação de vencimento por
e-mail/WhatsApp. Anexo de nota fiscal. App móvel nativo.

## Riscos

- **A planilha continua sendo editada em paralelo durante a transição.** Mitigação: o
  importador é idempotente e pode ser reexecutado; combinar uma data de corte com a equipe.
- **Os 110 itens "a confirmar" (TOYOTA + MORELLI) podem nunca ser reclassificados.** Mitigação:
  o selo é visível no dashboard, não escondido num filtro.
