# Painel de Locação — comportamento atual (linha de base para a migração)

Mapeado em 2026-08-04 a partir de `apps/painel-locacao` (Next.js 16 + Prisma + SQLite) e da
suíte Playwright existente (`e2e/autenticacao.spec.ts`, `ciclo-vida.spec.ts`,
`importar.spec.ts`, `responsivo.spec.ts` — 975 linhas). Segue o mesmo formato de
`migracao-go/portal/COMPORTAMENTO.md`: comportamento observável, com os porquês que não
aparecem batendo o olho no código.

Escopo: **CRUD/ciclo de vida de locações + obras + fornecedores + dashboard + import/export
Excel/PDF** — o módulo inteiro, decisão do usuário em 2026-08-04 (não fatiar em fases).

## 1. Autenticação

Idêntica ao mecanismo do Portal (`migracao-go/portal/COMPORTAMENTO.md` §2): cookie
`locacao_sessao`, JWT HS256 com `AUTH_SECRET` compartilhado, verificação sem consultar banco.
Duas diferenças específicas deste módulo:

- **Dois pisos de autorização, não um.** `exigirSessao()` (qualquer sessão válida) e
  `exigirLancamento()` (sessão + `podeLancar(cargo)` — ADMIN/OPERACIONAL/GERENTE). Toda
  Server Action de escrita chama `exigirLancamento()`; leitura de página chama só
  `exigirSessao()`. Quem tem cargo CONSULTA vê as telas mas as ações de escrita lançam erro
  ("Seu cargo permite apenas consultar…"). Existem também `exigirAprovacao()` e
  `exigirAdministracao()`, não usados por nenhuma action deste módulo hoje (reservados).
- **Rotas de API respondem 401, não redirecionam.** `/api/export/xlsx` e `/api/export/pdf`
  chamam `lerSessao()` diretamente (não `exigirSessao()`) porque rota de API não passa pelo
  layout de `(app)` que faria o redirect — sem essa checagem manual, a planilha inteira
  (custo por obra, valor por fornecedor) sairia para qualquer um que digitasse a URL.
- Páginas protegidas: `/`, `/locacoes`, `/locacoes/nova`, `/obras`, `/fornecedores`,
  `/importar` — todas redirecionam pra `${URL_PORTAL}/entrar?destino=<original>` sem sessão
  (o Portal é quem tem a tela de login; este módulo não tem `/entrar` de verdade — na prática
  o app de teste local mantém uma cópia da tela de login do Portal para rodar isolado, mas em
  produção o redirect vai para a porta do Portal).

## 2. Modelo de dados

```
Obra
  id, cliente, codigo (UNIQUE), descricao, responsavel?, abaOrigem, ativa (default true),
  criadoEm
  INDEX(cliente)

Fornecedor
  id, nome (UNIQUE), telefone?, ativo (default true), criadoEm

FornecedorAlias
  id, alias (UNIQUE globalmente, não só por fornecedor!), fornecedorId -> Fornecedor CASCADE
  INDEX(fornecedorId)

Locacao
  id, descricao, trCodigo?, quantidade (default 1), estado (default "OK"), observacoes?,
  dataInicio?, dataFim?, valorItem?, devolvidaEm?, obraAConfirmar (default false),
  possivelDuplicata (default false), numeroOrigem?, criadoEm, atualizadoEm (auto)
  obraId -> Obra (NOT NULL), fornecedorId -> Fornecedor (nullable)
  INDEX(obraId), INDEX(fornecedorId), INDEX(dataFim), INDEX(devolvidaEm)

Movimentacao
  id, tipo, descricaoHumana, payloadAntes? (JSON serializado), payloadDepois? (JSON serializado),
  criadoEm
  locacaoId -> Locacao CASCADE
  INDEX(locacaoId)
```

**`FornecedorAlias.alias` é único GLOBALMENTE**, não por fornecedor — é essa constraint que
faz `salvarFornecedor` recusar reatribuir um apelido que já pertence a outro fornecedor (ver
§4). **`Obra`** é a entidade que a decisão de banco único (`migracao-go/README.md` §"Banco
único") aponta para unificar entre módulos — aqui ela ganha um campo extra que os outros
módulos não têm: **`abaOrigem`**, usado só pelo importador (§6) para saber de qual aba da
planilha os itens da obra vêm. Ao desenhar o schema compartilhado, este campo deve ficar
como uma extensão específica do Painel, não vazar para o modelo comum.

**Datas são meia-noite UTC representando um DIA DE CALENDÁRIO, não um instante** — a decisão
mais importante de todo este módulo. `2026-08-08T00:00:00Z` significa "8 de agosto", e ler
seus componentes em horário local jogaria pro dia anterior no Brasil (UTC−3). Toda comparação
de data (status, filtros, exportação) precisa usar os componentes UTC, nunca `time.Now()`
local nem `startOfDay` de fuso local. Ver §5.

## 3. Regras de domínio puras (`lib/dominio/`)

### 3.1 Status (`status.ts`)

```
calcularStatus(dataFim, devolvidaEm, hoje):
  devolvidaEm != null        → DEVOLVIDA
  dataFim == null            → SEM_PRAZO
  diasRestantes < 0          → VENCIDA
  diasRestantes <= 7          → ATENCAO   (DIAS_ATENCAO = 7, vem da legenda da planilha original)
  caso contrário              → ATIVA
```

`diasRestantes(dataFim, hoje)` = dia-calendário de `dataFim` (componentes UTC) menos
dia-calendário de `hoje` (componentes LOCAIS — "hoje" é o dia de quem está olhando a tela,
não UTC). Consequência prática pro Go: quem calcula `hoje` do lado do servidor precisa saber
o fuso do usuário, ou aceitar que o servidor roda no fuso da construtora (America/Sao_Paulo,
como o `playwright.config.ts` já assume) — **não usar UTC puro para "hoje"**.

`limiteEmDias(dias, hoje)` gera o limiar em Date UTC-meia-noite pra usar em cláusula SQL —
usado por `clausulaStatus` nas queries e por `obterIndicadores`. Filtro de status em SQL
sempre neste referencial, nunca `startOfDay` de biblioteca de data (discordaria da etiqueta
que a tabela mostra).

`rotuloVencimento`: "vence em N dias" / "vence hoje" / "vencida há N dias" / "sem prazo".

### 3.2 Período (`periodo.ts`) — como o valor é calculado

```
periodoPorDias(dias):
  dias <= 1   → Diário
  dias <= 7   → Semanal
  dias <= 15  → Quinzenal
  caso contrário → Mensal

quantidadePeriodos(dias):
  Diário   → dias
  Semanal  → ceil(dias / 7)
  Quinzenal → ceil(dias / 15)
  Mensal   → ceil(dias / 30)

valorTotal(valorItem, inicio, fim):
  se !valorItem → 0
  dias = duracaoEmDias(inicio, fim)   // differenceInCalendarDays, componentes de calendário
  se dias <= 0  → valorItem            // duração inválida/zero: cobra o valor cheio, sem multiplicar
  senão         → valorItem * quantidadePeriodos(dias)
```

Este é o cálculo que aparece nos KPIs do dashboard, na planilha exportada e no PDF — precisa
ser byte-a-byte igual nos três lugares (e no Go).

### 3.3 Constantes (`constantes.ts`)

- `STATUS`: ATIVA, ATENCAO, VENCIDA, DEVOLVIDA, SEM_PRAZO
- `ESTADO`: OK, PERDIDO, DANIFICADO
- `MOVIMENTACAO`: REGISTRO, EDICAO, RENOVACAO, TRANSFERENCIA, DEVOLUCAO, IMPORTACAO,
  RECLASSIFICACAO
- `DIAS_ATENCAO = 7`
- `PERIODOS` (para o seletor "período rápido" do formulário): Diário=1, Semanal=7,
  Quinzenal=15, Mensal=30, Trimestre=90 dias

### 3.4 Formato (`formato.ts`)

- `brl(valor)`: `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`
- `dataBR(data)`: formata data ARMAZENADA (meia-noite UTC) em `DD/MM/AAAA`, timezone UTC
  explícito no formatador — **nunca** o fuso do processo
- `dataLocalBR(data)`: formata um INSTANTE real (ex.: carimbo "emitido em") no fuso local —
  função DIFERENTE de propósito, ver comentário no código: usar a errada faz o PDF/planilha
  adiantar um dia depois das 21h em Brasília
- `parseDataBR(texto)`: aceita `"31/07/2026"` ou `"2026-07-31"`, devolve `Date` UTC-meia-noite
  ou `null`

## 4. Regras de negócio — Server Actions

### 4.1 Obras (`actions/obras.ts`)

- `salvarObra(id, entrada)`: cria ou atualiza. `codigo` único — violação vira
  `"Já existe uma obra com o código {codigo}."`. Criação seta `abaOrigem = codigo` (só
  editável depois via banco, não tem campo próprio no formulário — a intenção original é
  que a aba da planilha tenha o mesmo nome do código da obra).
- `alternarObra(id, ativa)`: ao DESATIVAR, recusa se houver locação em aberto
  (`devolvidaEm: null`) naquela obra — `"Esta obra tem N locações em aberto. Devolva ou
  transfira antes de desativar."`. Ativar não tem restrição.
- `listarObras()`: ordenada por cliente, depois código; inclui contagem de locações.

### 4.2 Fornecedores (`actions/fornecedores.ts`)

- `salvarFornecedor(id, entrada)`: `aliases` é uma string separada por vírgula, splitada e
  trimada. **Antes de salvar, verifica se algum alias já pertence a OUTRO fornecedor** — sem
  essa checagem explícita, um upsert reatribuiria o apelido silenciosamente, e toda
  importação futura daquela grafia cairia no fornecedor errado sem nenhum aviso. Ao editar,
  os aliases antigos são **substituídos por completo** (delete all + recreate), numa
  transação — nunca merge incremental.
- `alternarFornecedor(id, ativo)`: sem restrição (diferente de obra — pode desativar com
  locação em aberto).

### 4.3 Locações (`actions/locacoes.ts`) — o ciclo de vida

Todas exigem `exigirLancamento()`. Toda mutação bem-sucedida grava uma `Movimentacao` com
`descricaoHumana` pronta para exibir (não recalculada na tela) e frequentemente
`payloadAntes`/`payloadDepois` em JSON.

- **`criarLocacao`**: valida `dataFim >= dataInicio`; `descricao` é gravada em **CAIXA ALTA**
  (`.toUpperCase()`). Cria a movimentação REGISTRO com
  `"Registrada de {dataBR(inicio)} a {dataBR(fim)}"`.
- **`editarLocacao`**: schema parcial (todo campo opcional). Regra sutil: a validação de
  data compara contra o que **FICARÁ** gravado, não contra o que veio no formulário — editar
  só o início pode inverter a ordem em relação ao fim já existente no banco, e isso também é
  barrado (`"A data de fim ficaria anterior à de início."`). Movimentação EDICAO com
  antes/depois em JSON.
- **`renovarLocacao(id, diasExtras?)`**: recusa se já devolvida ou sem `dataInicio`/`dataFim`.
  Se `diasExtras` não vier, usa a duração atual da locação (`fim - início`) como o tanto a
  acrescentar. `novaData = dataFim + dias` (soma em componentes UTC,
  `setUTCDate`). Movimentação RENOVACAO: `"Renovada por N dias — novo fim {data}"`.
- **`devolverLocacao(id, dataDevolucao, motivo?)`**: recusa se já devolvida. **Só preenche
  `devolvidaEm` — a linha NUNCA é apagada nem recriada.** Isto é o comportamento mais
  importante do módulo inteiro: o sistema anterior (a planilha) apagava a linha ativa e
  recriava no bloco DEVOLUÇÕES com `dataInicio` sobrescrita pela data de devolução — é por
  isso que as 63 devoluções importadas têm início = fim, o tempo real na obra já estava
  perdido antes de chegar aqui. Movimentação DEVOLUCAO:
  `"Devolvida em {data} — permaneceu N dias na obra"` (N calculado do `dataInicio`
  ORIGINAL) `" · {motivo}"` se houver motivo.
- **`transferirLocacao(id, obraDestinoId, dataInicio, dataFim, motivo?)`**: recusa se já
  devolvida, se destino == origem, ou se `fim < início`. Atualiza `obraId`, `dataInicio`,
  `dataFim` e zera `obraAConfirmar`. Movimentação TRANSFERENCIA:
  `"Transferida de {codigoOrigem} para {codigoDestino} — novo período {inicio} a {fim}"` `"
  · {motivo}"` se houver, com `payloadAntes`/`payloadDepois` guardando código da obra e
  datas.
- **`reclassificarEmLote(ids[], obraDestinoId)`**: usado para resolver o `obraAConfirmar`
  (ver §6 — itens de abas compartilhadas entre obras). Atualiza todas as locações E cria uma
  `Movimentacao` RECLASSIFICACAO por item, numa transação `$transaction` só. Erro se `ids`
  vazio ou obra destino não existir.

**Locação devolvida perde todas as ações** (Editar/Renovar/Transferir/Devolver somem da UI) —
mas o histórico continua acessível, é modo leitura, não desaparecimento.

## 5. Consultas (`queries/`)

### 5.1 `listarLocacoes(filtros, hoje)`

Filtro por status usa `clausulaStatus`, no MESMO referencial UTC-meia-noite de `dataFim`
(nunca `startOfDay` local — discordaria da etiqueta da tabela):

| Status filtrado | Cláusula |
|---|---|
| (nenhum) | `devolvidaEm IS NULL` |
| `DEVOLVIDA` | `devolvidaEm IS NOT NULL` |
| `VENCIDA` | `devolvidaEm IS NULL AND dataFim < hoje` |
| `ATENCAO` | `devolvidaEm IS NULL AND dataFim BETWEEN hoje AND hoje+7` |
| `ATIVA` | `devolvidaEm IS NULL AND dataFim > hoje+7` |
| `SEM_PRAZO` | `devolvidaEm IS NULL AND dataFim IS NULL` |
| `TODAS` | sem recorte — inclui devolvidas (usado pelo cartão "itens perdidos": 4 dos 16
  perdidos já foram devolvidos, e o número do cartão precisa bater com a lista ao clicar) |

Busca textual (`busca`) usa `OR contains` em `descricao`, `trCodigo`, `observacoes`,
`numeroOrigem`. Filtros adicionais: `obraId`, `fornecedorId`, `estado`, `aConfirmar` (bool
→ `obraAConfirmar: true`). Ordenação: `dataFim ASC NULLS LAST`, depois `descricao ASC` — sem
prazo aparece **por último**, não primeiro (SQL padrão ordenaria NULL antes de qualquer
data).

### 5.2 Dashboard (`queries/dashboard.ts`)

`obterIndicadores(hoje)`: `valorEmLocacao` (soma de `valorTotal` sobre não-devolvidas),
`ativos` (contagem não-devolvidas), `vencemEm7Dias`, `vencidos`, `perdidos` (**ignora
`devolvidaEm` de propósito** — prejuízo já incorrido conta mesmo se a locação foi encerrada
depois), `perdidosEmAberto` (mesma contagem mas só não-devolvidas), `aConfirmar`.

`obterPorFornecedor()` / `obterPorObra()`: agregação em memória (não SQL `GROUP BY`) de valor
e quantidade por fornecedor/obra, só sobre não-devolvidas, ordenado por valor decrescente.
Sem fornecedor → agrupa em `"Sem fornecedor"`.

`obterVencimentosProximos(hoje)`: não-devolvidas com `dataFim <= hoje+7` — **sem piso
inferior**, então vencidas aparecem juntas com as por vencer (quem abre de manhã precisa ver
as duas coisas na mesma lista), ordenadas por `dataFim ASC`, limite 25.

## 6. Importação de planilha Excel (`lib/planilha/`, `actions/importar.ts`)

O subsistema mais intrincado do módulo. Fluxo: **upload → prévia (não grava nada) →
confirmar (grava)**. Duas Server Actions descartam o resultado da prévia se o usuário não
confirmar — a leitura do arquivo é idempotente e não tem efeito no banco.

### 6.1 Abrir o arquivo (`parser.ts: abrirPlanilha`)

A planilha real da construtora grava comentários em `xl/comments/comment1.xml` em vez do
caminho padrão OOXML (`xl/comments1.xml`), o que quebra o parser Excel na leitura direta.
Contorno: abrir o `.xlsx` como ZIP, remover todo arquivo/relacionamento de comentário
(`comments?/`, `.vml`, `commentsN.xml` e as entradas `<Relationship>`/`<Override>`
correspondentes em `.rels` e `[Content_Types].xml`), religar o ZIP em memória, só então
entregar pro parser Excel. **O arquivo em disco nunca é alterado.** Pra portar em Go: testar
primeiro se a biblioteca Excel escolhida (`excelize` é a opção padrão) já tolera esse layout
de comentário sem precisar do mesmo contorno — se tolerar, não reimplementar a manipulação
de ZIP à toa (YAGNI); se não tolerar, портar o mesmo contorno via `archive/zip` do Go.

### 6.2 Localizar os blocos dentro de cada aba

- Abas em `ABAS_IGNORADAS` (`{"RESUMO"}`) são puladas.
- Cabeçalho: primeira linha (varrendo até a linha 60) cuja coluna 1 é exatamente `"Nº"`.
  Sem cabeçalho encontrado → aba inteira marcada como ignorada com o motivo.
- Bloco DEVOLUÇÕES: primeira linha (varrendo até 400) cuja coluna 1 é `"DEVOLUÇÕES"` ou
  `"DEVOLUCOES"`. Bloco de locações ativas vai do cabeçalho até ali (ou até o fim da aba, se
  não existir bloco de devoluções).
- Marcadores de fim de bloco (`FIM_DO_BLOCO`): `"LEGENDA:"`, `"DEVOLUÇÕES"`,
  `"DEVOLUCOES"`, `"◂ VOLTAR AO RESUMO"` — encontrar qualquer um interrompe a leitura do
  bloco corrente. Necessário porque a planilha às vezes repete o banner "DEVOLUÇÕES" em
  duas linhas seguidas preenchendo todas as colunas — sem filtrar, a segunda linha do banner
  vira uma "devolução" fake com fornecedor="DEVOLUÇÕES".
- Bloco DEVOLUÇÕES para de ler após **20 linhas vazias seguidas** (heurística de fim de
  dados, já que não há marcador de fechamento).

### 6.3 Colunas (índice 1-based)

| Índice | Campo | Coluna 15 tem regra própria — ver 6.4 |
|---|---|---|
| 1 | `Nº` → `numeroOrigem` | |
| 2 | Descrição do equipamento | vazio → linha ignorada (não é registro) |
| 3 | `Tr` → `trCodigo` | |
| 4 | Início | célula Date |
| 5 | Fim | célula Date |
| 12 | Valor do item | número, aceita vírgula decimal |
| 14 | Fornecedor (texto bruto) | |
| 15 | ver `classificarColuna15` | |

Leitura de célula lida com 3 formas: valor direto, fórmula (`{formula, result}` — usa
`result`), rich text (`{richText: [...]}` — concatena os `.text`). **Normalizar/desembrulhar
sempre ANTES de classificar** — sem isso uma célula de fórmula vira a string literal
`"[object Object]"` e entra no banco como observação.

### 6.4 Coluna 15 — um campo, três significados (`coluna15.ts`)

Célula é texto livre reaproveitado para três coisas diferentes, decidido por regex, nesta
ordem:
1. Vazio, ou casa `/^(unidades|observações|obs)$/i` (cabeçalho repetido/lixo) → tudo `null`.
2. Número puro (`"8"`, `"8.0"`, `"8,0"`) → `quantidade` (arredondado, `0` ou negativo vira
   `null`).
3. `/^perdid[oa]s?$/i` → `estado = PERDIDO`; `/^ok$/i` → `estado = OK`;
   `/^danificad[oa]s?$/i` → `estado = DANIFICADO`.
4. Qualquer outro texto → `observacoes` (verbatim).

### 6.5 Mapeamento aba → obra (`mapa-abas.ts`)

Construído a partir do campo `Obra.abaOrigem` de todas as obras cadastradas — **não é uma
tabela fixa no código**, é o que permite importar a planilha de qualquer empresa contanto que
as obras estejam cadastradas informando a aba de origem. Quando **duas ou mais obras** apontam
pro mesmo `abaOrigem`, a aba é "compartilhada": a primeira obra (por ordem de `codigo`) vira
`obraPrincipal` e recebe todos os itens daquela aba, marcados `obraAConfirmar = true` — não
há como saber automaticamente a qual das obras cada item pertence, então entram todos na
principal para reclassificação manual em lote pela interface (`reclassificarEmLote`, §4.3).
Itens do bloco DEVOLUÇÕES de aba compartilhada **não** ficam `obraAConfirmar` (só ativas
precisam de confirmação).

### 6.6 Deduplicação e detecção de duplicata entre abas

**Chave de idempotência de reimportação** (evita duplicar ao reimportar o mesmo arquivo):
`obraId + descrição normalizada + trCodigo + dataInicio(ISO) + numeroOrigem`. A princípio
`descrição + Tr + obra + início` bastaria, mas `Tr` é número de requisição (cobre vários
itens) e há colisões reais na planilha entre linhas genuinamente distintas — `numeroOrigem`
(a própria coluna "Nº", determinística por arquivo) resolve as colisões observadas sem
quebrar a idempotência.

**`possivelDuplicata`** é outra coisa: sinaliza (nunca descarta) quando a MESMA assinatura
aparece em **abas diferentes** — a planilha genuinamente repete equipamentos entre abas de
obras diferentes, e como `Tr` não identifica o equipamento é impossível distinguir
automaticamente um erro de copiar/colar de uma remessa legitimamente dividida. Duas
assinaturas, calculadas separadamente para ativos e devolvidos (nunca cruzam):
- Ativos: `descrição normalizada + Tr`.
- Devolvidos: `descrição normalizada + Tr + dataInicio.getTime() + valorItem` —
  **propositalmente sem `dataFim`**: no bloco DEVOLUÇÕES a planilha usa `fim = início` como
  marcador de campo vazio em uma das abas duplicadas, e incluir `dataFim` faria a comparação
  falhar bem onde a duplicata é mais provável. Entre falso positivo (custa uma revisão
  humana) e falso negativo (custo duplicado invisível nos indicadores), a escolha é marcar
  demais.

Normalização de descrição para comparação: NFD, remove diacríticos, maiúsculas, colapsa
espaços, trim.

### 6.7 `gerarPrevia` / `confirmarImportacao`

- `gerarPrevia`: só leitura — parseia, cruza contra fornecedores/obras já cadastrados, monta
  contagens (total, ativos, devolvidos, perdidos, aConfirmar, duplicatas, fornecedores novos
  detectados por nome normalizado sem alias correspondente, contagem por aba, linhas
  ignoradas com motivo). **Não grava nada.**
- `confirmarImportacao`: cria fornecedores novos primeiro (nome bruto, trimado, sem alias) —
  recarrega o mapa fornecedor a cada criação; depois, para cada linha: pula se obra não
  mapeada (`puladas++`) ou chave já existe (`puladas++`); senão cria a `Locacao` com
  `devolvidaEm = dataFim ?? dataInicio ?? hoje` quando a linha é do bloco devoluções, e uma
  `Movimentacao` IMPORTACAO (`"Importado da aba {aba}, linha {linha}"`). Devolve
  `{criadas, puladas, fornecedoresCriados}`.
- `receberUpload`: grava o arquivo enviado em `dados/upload-<timestamp>.xlsx` no servidor;
  só devolve o caminho, não toca o banco. Recusa extensão fora de `.xlsx`/`.xlsm`.

### 6.8 Números de referência (planilha real da construtora, `dados/Maquinas_Alugadas_Controle_REVISADA.xlsx`)

Conferidos célula a célula em 2026-08-01 (ver `e2e/apoio.ts` `ESPERADO`) — a suíte Go deve
reproduzir exatamente estes números a partir do MESMO arquivo:

```
ativos: 242 · devolvidos: 63 · perdidos: 16 · aConfirmar: 110 · totalImportado: 305
ativosDuplicados: 90 · devolucoesDuplicadas: 20
```

## 7. Exportação

### 7.1 Excel (`exportar-xlsx.ts`, `GET /api/export/xlsx`)

401 sem sessão (ver §1). Gera um workbook com:
- Aba `RESUMO`: uma linha por obra (cliente, código, descrição, responsável, itens ativos,
  valor em locação somado via `valorTotal`), mais uma linha `TOTAL GERAL` em negrito.
- Uma aba por obra (nome sanitizado: remove `: \ / ? * [ ]`, corta em 31 caracteres — limite
  do formato Excel), com bloco LOCAÇÕES (ativas) e, se houver, bloco DEVOLUÇÕES — mesmo
  cabeçalho de 16 colunas em ambos, célula de STATUS colorida por status
  (vencida=vermelho claro, atenção=amarelo claro, ativa=verde claro, devolvida/sem
  prazo=cinza claro). Painel congelado abaixo do cabeçalho (`ySplit: 5`).
- Nome do arquivo: `locacoes-sc-{AAAA-MM-DD}.xlsx`.

### 7.2 PDF (`exportar-pdf.ts`, `GET /api/export/pdf`)

401 sem sessão. Só obras **ativas** com locações **não devolvidas**. Uma "seção" por obra
(quebra de página entre obras, não dentro — só transborda pra página nova quando falta
espaço vertical, repetindo cabeçalho de tabela e indicando "(continuação, página N)"). Layout
A4 paisagem. 7 colunas: Equipamento (corta em 42 char), Tr, Fornecedor (corta em 26),
Início, Fim, Situação (`rotuloVencimento`, colorida por status), Total (`valorTotal`, moeda
BRL à direita). Rodapé por obra: contagem de itens ativos + soma do valor. Carimbo de emissão
usa `dataLocalBR` (instante real, fuso local) — **nunca `dataBR`** (que é pra data
armazenada) nesse contexto específico, senão adianta um dia depois das 21h em Brasília.

## 8. Comportamento de UI que os testes verificam

Rotas: `/` (dashboard), `/locacoes` (lista, aceita `?status=`), `/locacoes/nova`, `/obras`,
`/fornecedores`, `/importar`.

**Listagem de locações**: `data-testid="tabela-locacoes"` (desktop) e
`data-testid="lista-cards"` (≤1024px, mesmo conteúdo, escondido por CSS conforme largura —
os dois existem no DOM ao mesmo tempo). `data-testid="contagem"` mostra `"{N} itens"`. Cada
linha é um botão clicável que abre `data-testid="drawer-locacao"` com abas, uma delas
"Histórico" (`getByRole('tab', {name: /Histórico/})`, mostra a contagem entre parênteses
quando fechada: `"Histórico (4)"`) contendo `data-testid="historico"` — lista de
`<li>`, uma por movimentação, mais recente primeiro, texto = a `descricaoHumana` gravada.

**Formulário de nova locação** (`/locacoes/nova`): labels exatos —
`"Obra *"`, `"Equipamento *"`, `"Código Tr"`, `"Fornecedor"`, `"Valor do item (R$)"`,
`"Início *"`, `"Fim *"`, `"Período rápido"` (select com as opções de `PERIODOS`: escolher
recalcula "Fim" a partir do "Início" já preenchido). Botão `"Registrar locação"`, redireciona
pra `/locacoes` no sucesso.

**Ações no drawer**: botões "Editar", "Renovar", "Transferir", "Devolver" — **nenhum
aparece se a locação está devolvida** (só o histórico, modo leitura). Cada ação abre um
diálogo: `data-testid="dialog-renovar"` (campo "Dias a acrescentar"), `"dialog-transferir"`
(campo "Obra de destino *" pré-carrega **o `dataInicio` original** no campo "Início *" do
diálogo — a transferência não é pensada pra mudar quando o equipamento chegou, só pra onde
ele vai e até quando; mais "Fim *" e "Motivo"), `"dialog-devolver"` (campo "Data da devolução
*" já vem preenchido com uma data proposta pela tela, mais "Motivo"). Todos com botão
"Confirmar".

**Importação** (`/importar`): input de arquivo `#planilha`, botão "Analisar" → prévia
(`"Prévia — nada foi gravado ainda"`) com cartões `data-testid="previa-{campo}"` (`ativos`,
`devolvidos`, `perdidos`, `aConfirmar`, `possiveisDuplicatas` — soma as duas origens de
duplicata num só cartão), lista condicional "Fornecedores que serão criados" e "Linhas não
interpretadas" (ambas ausentes quando vazias, não mostradas com "0"). Botão
`"Confirmar importação de {N} registros"` (N = total que SERIA criado). Após confirmar:
`data-testid="importacao-concluida"`, texto `"{criadas} locações criadas, {puladas} já
existiam"`.

## 9. Seed (`prisma/seed.ts`)

Fonte dos dados: `prisma/dados-exemplo.ts` quando `prisma/dados-locais.json` não existe
(dados fictícios — arquivo de dados reais da construtora é gitignored, nunca commitado). Cria
obras e fornecedores de exemplo determinísticos; usado como estado inicial em dev e como
ponto de partida antes de `reiniciarBanco()` rodar nos testes.
