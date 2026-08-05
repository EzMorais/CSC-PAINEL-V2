# Almoxarifado (Estoque) — comportamento mapeado do Next.js

Fonte: `apps/estoque` (Next.js 16 + Prisma + SQLite próprio). Este documento descreve o
comportamento observável que a implementação Go precisa reproduzir, mesmo padrão de
`portal/COMPORTAMENTO.md` e `painel/COMPORTAMENTO.md`.

## §1 Autenticação e autorização

Mesmo mecanismo dos outros módulos: cookie `locacao_sessao` assinado com `AUTH_SECRET`
compartilhado, lido via JWT (`jose`/`golang-jwt`), campo `cargo` com fallback para `papel`
(compatibilidade retroativa). Quatro níveis de guarda, cada action chama a mais forte que
precisa (nunca só confia na tela):

- `exigirSessao` — piso de tudo. Sem sessão, redireciona para `{PORTAL}/entrar?destino=...`.
- `exigirLancamento` — cria, edita, movimenta. `PodeLancar`: ADMIN, OPERACIONAL, GERENTE.
- `exigirAprovacao` — decide pedidos de aprovação. `PodeAprovar`: ADMIN, GERENTE, DIRETORIA
  (OPERACIONAL fica de fora de propósito — é quem lança, não pode also aprovar).
- `exigirAdministracao` — configurações sensíveis (conta de e-mail). `PodeAdministrar`: só ADMIN.

No Go, os 3 primeiros já existem prontos em `internal/domain/identidade`
(`PodeLancar`/`PodeAprovar`/`PodeAdministrar`) — reaproveitar, não duplicar.

## §2 Modelo de dados

`Obra` e `Fornecedor` **são as tabelas compartilhadas já criadas pelo Painel**
(`obras`/`fornecedores`, migration `0002_painel.sql`) — Estoque referencia por FK, não
recria. Único ajuste de schema necessário: `Fornecedor` no Next.js do Estoque tem `cnpj` e
`email` que o Painel não usa — adicionar como colunas nullable na tabela compartilhada
(migration aditiva), sem quebrar o Painel.

Tabelas próprias do Estoque (schema completo em `apps/estoque/prisma/schema.prisma`):

- **Material** — cadastro do item. Sem saldo armazenado (ver §3). `categoria` (12 valores,
  `CATEGORIA_MATERIAL`), `unidade` (11 siglas, `UNIDADE`), `estoqueMinimo` (ponto de alerta,
  digitado à mão), `ca`/`validadeCA` (Certificado de Aprovação — só populado quando
  `categoria = EPI`, zerado nas demais). Soft-delete via `ativo`.
- **Movimentacao** — livro-razão append-only. `quantidade` sempre positiva; o sinal vem do
  `tipo` via `SINAL_MOVIMENTACAO` (nunca da coluna). `valorUnitario` só em ENTRADA.
  `obraId`/`fornecedorId` opcionais conforme o tipo (§3). `funcionarioId`/`funcionarioNome`
  como texto puro (id do banco do RH, sem FK — bancos hoje separados; quando RH migrar para
  o mesmo binário Go, isso pode virar FK real, mas não antes). `sincronizadoEm`/
  `erroSincronizacao` rastreiam a ficha de EPI enviada ao RH.
- **SolicitacaoCompra** + **ItemSolicitacao** — pedido de compra. Item grava `saldoNaEpoca`/
  `minimoNaEpoca` como fotografia (não recalcula depois).
- **Aprovacao** — fila de aprovação. `dados` é JSON (formato depende de `tipo`), `resumo` é
  texto pronto pra listar sem parsear o JSON. `referenciaId` aponta pro que foi criado quando
  aprovado.
- **ConfiguracaoEmail** — linha única (`id = 'unica''`), conta SMTP + os dois limiares de
  aprovação (`limiteAprovacaoCompra`, `limiteAjusteInventario`).

## §3 Regras puras de domínio

- **Saldo nunca é armazenado.** Somado a partir de `Movimentacao` a cada leitura
  (`saldoDoMaterial`/`saldoPorMaterial`, agregação em memória por `SINAL_MOVIMENTACAO` — não
  em SQL, pra regra de sinal morar num lugar só). Motivo explícito no schema: uma coluna de
  saldo poderia discordar do histórico sem forma de saber qual dos dois está certo.
- **`SINAL_MOVIMENTACAO`**: ENTRADA +1, DEVOLUCAO +1, AJUSTE_POSITIVO +1, SAIDA -1, PERDA -1,
  AJUSTE_NEGATIVO -1.
- **`situacaoDoSaldo(saldo, estoqueMinimo)`**: `saldo <= 0` → ZERADO; `estoqueMinimo > 0 &&
  saldo < estoqueMinimo` → ABAIXO; senão OK. Mínimo zero desliga o alerta de "abaixo" de
  propósito (== "não controlo reposição deste item").
- **`exigeFuncionario(tipo, categoria)`**: `tipo == SAIDA && categoria == EPI`. Só neste caso
  a saída pede funcionário em vez de obra, e dispara a ficha pro RH.
- **`EXIGE_OBRA`** = [SAIDA, DEVOLUCAO]. **`EXIGE_FORNECEDOR`** = [ENTRADA] (só entrada tem
  preço/fornecedor — o resto não).
- **Último preço pago** (`ultimoPrecoPorMaterial`): o `valorUnitario` da ENTRADA mais recente
  por material — custo de REPOSIÇÃO, não contábil (não serve de custo médio ponderado).
- **`sugerirItens`**: materiais ativos com `situacao != OK`; quantidade sugerida repõe até o
  DOBRO do mínimo (não até o mínimo exato — senão o item volta a bater no limite no dia
  seguinte); sem mínimo cadastrado, sugestão simbólica de 1 unidade.
- **Número de solicitação**: `SC-{ano}-{sequência}`, sequência = maior existente no ano + 1
  (não `COUNT`, pra não colidir depois de uma exclusão).
- **Código de material**: `MAT-{sequência}`, mesma lógica de maior-existente-mais-um.

## §4 Fluxo de aprovação (propose-then-execute)

`precisaAprovacao(cargo, excedeLimite) = excedeLimite && !PodeAprovar(cargo)`. Quem já pode
aprovar não passa pela fila — não é brecha: a fila existe pro Operacional não fechar sozinho
algo que mexe em saldo sem contrapartida.

Três gatilhos, cada um grava um `Aprovacao` com `dados` JSON específico e **nada muda no
estado real** até a decisão:

1. **PERDA** — toda perda lançada por quem não aprova vai para fila, **sem limiar de valor**
   (o que importa é a baixa sem contrapartida, não o tamanho dela).
2. **AJUSTE_INVENTARIO** — só se `|diferença| > limiteAjusteInventario` (padrão 10, é
   quantidade, não valor — furto de item barato em volume é o alvo).
3. **SOLICITACAO_COMPRA** — só se `total estimado > limiteAprovacaoCompra` (padrão R$1000).
   Neste caso a solicitação **já foi gravada** (rascunho existe), só o disparo do e-mail que
   espera aprovação.

**Aprovar** (`aprovar(id)`, exige `PodeAprovar`):
- Recusa se já decidido, ou se `solicitanteId == aprovadorId` (quem pediu não aprova o
  próprio pedido, mesmo sendo gerente — regra inteira da segregação).
- Revalida tudo de novo no momento de aprovar (material ainda ativo, saldo ainda bate) —
  entre pedido e decisão passam dias, o mundo pode ter mudado.
- AJUSTE_INVENTARIO: recalcula `diferença = quantidadeContada - saldoAtual`; se já é zero
  (saldo mudou e bateu sozinho), recusa com instrução de rejeitar o pedido em vez de aprovar
  vazio.
- PERDA: se `saldoAtual < quantidade pedida`, recusa com instrução de reabrir com quantidade
  certa.
- SOLICITACAO_COMPRA: dispara o e-mail agora (import dinâmico pra evitar ciclo entre os dois
  arquivos de actions).
- Grava `Movimentacao`/dispara e-mail, marca `Aprovacao` como APROVADA com `aprovadorId`,
  `aprovadorNome`, `decididoEm`, `referenciaId`.

**Rejeitar** (`rejeitar(id, motivo)`, motivo obrigatório, mín. 3 caracteres): mesma checagem
de auto-aprovação, marca REJEITADA com `motivoRejeicao`. Nada é executado.

## §5 Movimentação — `registrarMovimentacao`

Ordem de validação importa (replicar exatamente, cada uma tem uma razão pra vir onde vem):

1. Material existe e está ativo.
2. `exigeFuncionario(tipo, categoria)` decide entre exigir `funcionarioId` (EPI) OU exigir
   `obraId` (`EXIGE_OBRA`) — checar categoria ANTES da obra, senão toda entrega de EPI seria
   recusada por falta de obra que o formulário nem pede.
3. Se o tipo é de saída (`SINAL_MOVIMENTACAO < 0`): saldo atual tem que cobrir a quantidade,
   senão recusa com mensagem sugerindo ajuste de inventário (não deixa saldo ficar negativo
   — isso não existe fisicamente e contaminaria todo relatório).
4. PERDA sempre passa por `precisaAprovacao` — se precisar, abre pedido e RETORNA sem gravar
   nada (`pendenteAprovacao: true`, `id: null`).
5. Grava a `Movimentacao`. Campos condicionais: `obraId` só se `EXIGE_OBRA`, `fornecedorId`
   só se ENTRADA, `funcionarioId`/`funcionarioNome` só se `exigeFuncionario`.
6. Se era entrega de EPI, chama `sincronizarFicha` — **nunca lança**, falha fica registrada
   em `erroSincronizacao` pra reenvio manual, a saída do material já aconteceu e não pode
   parecer que falhou por causa de um sistema vizinho fora do ar.

**`ajustarPorInventario`**: pessoa digita a quantidade CONTADA (não a diferença — evita conta
de cabeça e escolha de tipo, dois jeitos de errar). Sistema deriva
`diferença = contada - saldoAtual`; zero é erro ("nada a ajustar"); acima do limite vai pra
aprovação, senão grava `AJUSTE_POSITIVO`/`AJUSTE_NEGATIVO` na hora com `quantidade =
|diferença|` e observação explicando contado-vs-sistema.

## §6 Integração com o RH — ficha de entrega de EPI

Cliente HTTP (`lib/cliente-rh.ts`) chama `{URL_RH}/api/integracao/entregas-epi`, autenticado
com um JWT de **máquina** (não de sessão de usuário): claims `{origem: "estoque", tipo:
"integracao"}`, `HS256`, mesmo `AUTH_SECRET`, validade de 60s (`lib/integracao.ts`, também
compartilhado — `assinarTokenIntegracao`/`verificarTokenIntegracao`). Timeout curto de
propósito (5s): o almoxarife está esperando na tela, se o RH não responde a saída segue e
fica marcada pendente, nunca trava a operação local.

Erro é classificado em `permanente` (4xx — reenviar dá o mesmo erro) vs transitório (timeout,
conexão recusada, 5xx). O Go reproduz o mesmo contrato HTTP e o mesmo comportamento de nunca
lançar — RH continua em Next.js até ser migrado, então esta chamada cruza processo mesmo
depois do Estoque estar em Go (mesma situação transitória que o Portal teve enquanto convivia
com os outros 4 apps).

## §7 Solicitação de compra e e-mail

`criarSolicitacao`: grava a solicitação (RASCUNHO) e os itens; se o total estimado passa do
limite e o cargo não aprova sozinho, abre `Aprovacao` e PÁRA (e-mail não sai — é o que não dá
pra desfazer). Senão dispara o e-mail imediatamente via `dispararEmailDaSolicitacao`.

`dispararEmailDaSolicitacao` nunca lança (mesmo motivo de `sincronizarFicha`): grava
`emailErro` na própria solicitação em vez de derrubar a criação. Sem conta de e-mail
vinculada não é erro — só significa que os botões manuais (Gmail/Outlook via `mailto`/deep
link) continuam sendo o caminho. Ao enviar com sucesso, a solicitação sai de RASCUNHO pra
ENVIADA automaticamente (o e-mail que já saiu é o próprio ato de envio, não precisa de
confirmação manual redundante).

Corpo do e-mail é TEXTO PURO, não HTML (viaja em URL `mailto`/`gmail`/`outlook` deep link —
HTML escapado em URL quebra em algum cliente). `LIMITE_URL = 8000` caracteres: acima disso a
tela oferece copiar o texto em vez do link direto.

`mudarStatusSolicitacao` NÃO mexe em saldo — marcar "atendida" só registra que chegou; quem
cria estoque de verdade é a `Movimentacao` de ENTRADA lançada com a nota fiscal na mão
(preço/quantidade reais quase nunca batem exatamente com o pedido).

`excluirSolicitacao`: só RASCUNHO pode ser excluído; depois de ENVIADA vira documento —
correção é "cancelar" (muda status), não apagar.

Configuração de e-mail (`configuracao-email.ts`, exige `exigirAdministracao`): provedor
GMAIL/OUTLOOK usa host/porta fixos (`SERVIDOR_PADRAO`), só OUTRO libera host/porta
manuais. Senha nunca volta pra tela — campo mostra um marcador (`••••••••`); se o valor
salvo é o marcador, mantém a senha antiga em vez de gravar o marcador por cima. `testarEnvio`
faz dois passos (verificar conexão + mandar e-mail de teste pra própria conta) porque aceitar
login não é o mesmo que conseguir entregar.

## §8 Consultas / agregações

- `listarMateriaisComSaldo(filtros)`: 1 query de materiais + 1 agregação de saldo (todos os
  materiais de uma vez, nunca N+1) + 1 de últimos preços, junta em memória. Filtro de
  `situacao` é aplicado DEPOIS (é campo derivado, não existe coluna pro SQL filtrar).
- `indicadores` (dashboard): total ativos, sem-estoque, abaixo-do-mínimo, valor em estoque
  (só soma saldo positivo — negativo é erro de lançamento, não "encolhe" o total), entradas/
  saídas do mês (UTC desde o dia 1), obras ativas.
- `consumoPorObra`: saídas menos devoluções por obra, valorizado pelo último preço — sinal
  invertido em relação ao saldo (aqui a pergunta é "quanto a obra levou", não "como o
  almoxarifado mudou").
- `listarFichasPendentes`: saídas de EPI com `funcionarioId != null && sincronizadoEm ==
  null` — fila de reenvio manual.

## §9 IDs de teste / interação

Sem drawer/modal — mesma decisão do Painel: navegação servidor-renderizada de verdade
(`/almoxarifado/materiais/{id}` como página de detalhe própria, ações via formulários
`<details>` expansíveis). Fila de aprovação e configurações são páginas próprias
(`/almoxarifado/aprovacoes`, `/almoxarifado/configuracoes`).

## §10 Seed

Materiais de exemplo cobrindo pelo menos: uma categoria comum (ex. CIMENTO_ARGAMASSA) com
saldo OK, um item ABAIXO do mínimo, um ZERADO, e um EPI com CA/validade preenchidos.
Movimentações de histórico suficientes para os saldos acima baterem. Uma solicitação em
RASCUNHO e uma `Aprovacao` PENDENTE (para a fila não aparecer vazia no primeiro teste).
