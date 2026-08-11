# Financeiro completo e automatizado — briefing e linha de raciocínio

> A implementação das abas Financeiro, Faturamento, Fiscal/SEFAZ, Contas a pagar e Contas
> a receber está detalhada em [ABAS_E_AUTOMACOES.md](ABAS_E_AUTOMACOES.md).

## 1. Resultado esperado

Construir um Financeiro que transforme fatos operacionais em previsão, obrigação,
liquidação e informação gerencial sem redigitação. Compras, contratos de locação,
folha e demais módulos originam títulos; o Financeiro aprova, agenda, paga/recebe, concilia
o banco e fecha o período. Toda mudança precisa dizer **quem, quando, por quê e qual era o
valor anterior**.

O objetivo não é apenas uma tela de contas a pagar. O ciclo completo é:

`fato gerador → título → aprovação → previsão → pagamento/recebimento → conciliação → fechamento → indicadores`

## 2. Princípios que orientam o desenho

1. **Dinheiro em centavos (`int64`)**, nunca `float64`. Percentuais usam pontos-base ou
   decimal controlado. Isso impede resíduos de arredondamento em baixa, rateio e conciliação.
2. **Livro financeiro imutável**. Pagamento não é sobrescrito: cancelamento/estorno cria o
   movimento inverso. Cadastro pode mudar; fato financeiro permanece auditável.
3. **Idempotência em toda automação**. A mesma nota, webhook, arquivo OFX ou evento de
   Compras não pode criar dois títulos ou duas baixas.
4. **Competência separada de caixa**. Emissão/competência alimenta DRE; pagamento efetivo
   alimenta caixa. Misturar as datas produz relatórios incorretos.
5. **Origem rastreável**. Todo título automático guarda módulo, tipo e ID de origem.
6. **Segregação de funções**. Quem cria/solicita não aprova e paga sozinho acima da
   alçada. Exceções exigem justificativa e auditoria.
7. **Automação sugere e executa apenas quando a confiança permite**. Conciliação exata
   pode ser automática; correspondência ambígua vai para revisão humana.
8. **Fechamento bloqueia retroatividade**. Ajuste em período fechado entra no período
   atual com referência ao original; reabertura é evento administrativo auditado.

## 3. Escopo funcional

### 3.1 Cadastros mestres

- contas bancárias e caixas, saldo inicial e responsáveis;
- plano de categorias financeiras em árvore (receita/despesa, operacional/não operacional);
- centros de custo, inicialmente ligados às obras compartilhadas, permitindo administrativo;
- clientes/fornecedores, formas de pagamento e dados bancários com acesso restrito;
- regras de aprovação por valor, categoria, obra e cargo;
- feriados e dias úteis para vencimento/agendamento.

### 3.2 Contas a pagar

- entrada manual e automática por Compras/recebimento/nota fiscal;
- parcelas, recorrência, anexos, retenções, descontos, juros e multa;
- rateio por categoria, centro de custo/obra e percentual/valor;
- estados `RASCUNHO → PENDENTE_APROVACAO → APROVADA → AGENDADA → PARCIAL/PAGA`;
- cancelamento, estorno, renegociação e substituição mantendo o encadeamento;
- lote de pagamentos com dupla aprovação conforme alçada.

### 3.3 Contas a receber

- títulos manuais e integração futura com medições/faturamento;
- parcelas, cobrança, recebimento parcial, desconto, juros e inadimplência;
- PIX/boleto via adaptadores, sem acoplar o domínio a um banco/provedor;
- régua de cobrança configurável e histórico de contatos.

### 3.4 Tesouraria e conciliação

- movimentos previstos e realizados por conta bancária;
- transferências entre contas como duas pernas da mesma operação;
- importação OFX/CSV e, depois, Open Finance/API bancária;
- identificação de duplicidade por conta + identificador bancário + valor + data;
- conciliação automática exata, sugestão por pontuação e fila de divergências;
- diferença de tarifa/juros gera lançamento separado, nunca altera silenciosamente o título.

### 3.5 Gestão

- fluxo de caixa realizado e projetado (diário, semanal e mensal);
- contas vencidas, a vencer, inadimplência, necessidade de caixa e posição bancária;
- DRE gerencial por competência, obra e categoria;
- orçado versus realizado, comprometido e projeção de término por obra;
- aging de clientes/fornecedores, prazo médio de pagamento/recebimento;
- fechamento mensal com checklist e exportações para contabilidade.

## 4. Automações

| Gatilho | Ação | Proteção |
|---|---|---|
| Recebimento de compra | cria conta a pagar e parcelas | chave `COMPRAS_RECEBIMENTO:<id>` |
| Título perto do vencimento | alerta responsável/aprovador | uma notificação por regra/data |
| Título vencido | muda visão para vencido e escala alerta | estado derivado, sem reescrever histórico |
| Aprovação concluída | disponibiliza para lote/agendamento | alçada e autoaprovação bloqueada |
| Extrato importado | deduplica e tenta conciliar | hash bancário idempotente |
| Match exato | baixa e concilia automaticamente | valor/moeda/conta/documento compatíveis |
| Match ambíguo | cria sugestão | exige confirmação humana |
| Pagamento/recebimento | atualiza aberto e projeção | transação atômica |
| Fechamento mensal | congela competência | permissão administrativa + auditoria |

Eventos internos usarão uma **outbox transacional** no SQLite. O caso de uso grava o fato e
o evento na mesma transação; um processador assíncrono envia notificações/integrações com
tentativa, prazo e fila de erro. Assim uma indisponibilidade externa nunca desfaz uma baixa.

## 5. Modelo conceitual

- `ContaFinanceira`: banco/caixa, moeda, ativo e saldo inicial.
- `CategoriaFinanceira`: classifica DRE e fluxo.
- `CentroCusto`: administrativo ou ligado a `obras.id`.
- `TituloFinanceiro`: pagar/receber, contraparte, origem, emissão, competência e total.
- `ParcelaFinanceira`: vencimento, valor original, aberto e estado.
- `RateioFinanceiro`: categoria + centro de custo + valor em centavos.
- `MovimentoFinanceiro`: baixa, estorno, tarifa, juros, desconto ou transferência.
- `LotePagamento` e itens: prepara/aprova/executa pagamentos em conjunto.
- `LinhaExtrato` e `Conciliacao`: representa o banco e sua ligação aos movimentos.
- `RegraAutomacao`, `EventoOutbox`, `EventoAuditoria` e `FechamentoFinanceiro`.

Invariantes principais: soma dos rateios = total; soma das parcelas = total; aberto nunca
negativo; movimento não conciliado não altera linha de extrato; uma linha de extrato não é
conciliada duas vezes; estorno referencia o movimento original; origem idempotente é única.

## 6. Segurança e aprovação

- perfis separados: consulta, lançamento, aprovação, tesouraria e administração;
- alçadas configuráveis, com segunda aprovação para valores altos;
- dados bancários e anexos fiscais fora de logs e respostas de integração;
- trilha de auditoria append-only com ator, IP, correlação, antes/depois e justificativa;
- backups testados, criptografia do volume/segredos e retenção conforme obrigação legal;
- exportação bancária inicialmente gera arquivo para conferência; envio direto exige
  assinatura/autenticação forte e homologação específica do banco.

## 7. Entrega incremental

1. **Fundação**: centavos, contas bancárias, categorias, centros de custo, título/parcela,
   movimentos, rateio, auditoria e outbox.
2. **Contas a pagar**: importar as contas já geradas por Compras, aprovar, pagar parcial ou
   integralmente, estornar e listar vencimentos.
3. **Tesouraria**: contas bancárias, transferências, posição e fluxo projetado.
4. **Conciliação**: OFX/CSV, deduplicação, match automático e fila de revisão.
5. **Contas a receber**: cobrança, baixas, inadimplência e régua automática.
6. **Gestão**: DRE, orçamento por obra, fechamento e integração contábil.

Cada etapa exige testes de unidade das invariantes, integração SQLite, handlers e cenários
Playwright antes da seguinte. A primeira fatia implementada junto deste documento cria a
fundação SQL e o caso de uso de baixa parcial/integral idempotente.

## 8. Decisões em aberto antes de integrações externas

- bancos, formatos de extrato/remessa e necessidade de CNAB 240/400;
- ERP/contabilidade de destino e plano de contas contábil;
- processo real de aprovação e alçadas por cargo/obra;
- regime e regras fiscais/retencões validadas pelo contador;
- origem das contas a receber e processo de medição/faturamento;
- canais de alerta e política de cobrança.

Essas escolhas não bloqueiam o núcleo: entram por configuração e adaptadores. Nenhuma API
bancária, regra fiscal ou disparo real deve ser presumido sem homologação.

## 9. Revisão detalhada e backlog priorizado

### Correções incorporadas na fundação

- idempotência agora é verificada dentro da transação antes do estado do título: repetir
  uma confirmação depois da liquidação integral devolve sucesso duplicado, não erro;
- reutilizar a mesma chave com título/tipo/valor diferente é conflito explícito;
- valor aceita somente centavos inteiros completos; texto parcialmente numérico é recusado;
- data vazia usa o instante atual, mas data preenchida e inválida é recusada;
- baixa exige conta financeira e, em títulos com mais de uma parcela, a parcela explícita;
- uma única parcela é selecionada automaticamente;
- saldo aberto tem `CHECK` para nunca ser negativo nem superar o valor original;
- movimentos e auditoria são append-only, protegidos também por triggers SQLite;
- contas legadas de valor zero não entram no novo livro como título inválido.

### P0 — antes de uso financeiro real

1. **Criação/aprovação de título**: validar soma das parcelas e rateios, bloquear
   autoaprovação e registrar cada transição na auditoria.
2. **Estorno transacional**: movimento inverso ligado ao original, reabrindo título/parcela;
   um movimento só pode ser estornado uma vez.
3. **Fechamento efetivo**: toda criação, baixa, estorno e conciliação deve consultar a
   competência fechada e recusar retroatividade.
4. **Dupla escrita Compras→Financeiro**: substituir a importação apenas inicial por uma
   porta local/outbox idempotente. Recebimento, estoque e título precisam ter recuperação
   consistente se uma etapa falhar.
5. **Perfis financeiros**: consulta, lançamento, aprovação e tesouraria separados dos cargos
   genéricos atuais; testar autorização em cada endpoint.
6. **Processador de outbox**: lease/lock, retentativa exponencial, limite, dead-letter e
   observabilidade. Hoje os eventos são gravados, mas ainda não consumidos.
7. **Backup/restauração homologados** antes de qualquer dado bancário de produção.

Critério P0: testes de concorrência e falha injetada provam que nenhuma operação duplica
movimento, deixa saldo divergente, burla aprovação ou modifica período fechado.

### P1 — primeira operação assistida

1. telas de vencimentos, filtros, detalhe, aprovação, baixa e estorno;
2. dashboard de caixa previsto/realizado e posição por conta;
3. importação OFX/CSV com prévia, hash de deduplicação e arquivo original preservado;
4. conciliação exata automática e fila manual para ambiguidades;
5. recorrência com geração antecipada e chave idempotente por competência;
6. anexos/documentos fiscais com limite, validação de conteúdo e acesso auditado;
7. alertas de vencimento processados pela outbox, com preferências e antirrepetição.

Critério P1: uma equipe consegue operar um mês completo sem planilha paralela, importar o
extrato e explicar toda diferença entre saldo bancário e livro financeiro.

### P2 — gestão e escala

1. contas a receber, PIX/boleto e régua de cobrança;
2. lotes/CNAB ou API bancária homologada com assinatura forte;
3. orçamento, comprometido, realizado e projeção por obra;
4. DRE gerencial e exportação contábil;
5. retenções/impostos definidos com a contabilidade;
6. indicadores, alertas de anomalia e previsão de caixa, sempre explicáveis e revisáveis;
7. política de arquivamento, LGPD e retenção documental.

### Detalhes de UX que evitam erro operacional

- exibir `R$ 1.234,56`, mas enviar centavos ou decimal validado pelo servidor;
- mostrar saldo antes/depois da baixa e exigir confirmação para juros/desconto/estorno;
- alertar duplicidade por fornecedor + documento + valor antes de criar título;
- diferenciar visualmente previsão, agendamento bancário e liquidação confirmada;
- nunca usar apenas cor para estado e nunca esconder a origem do lançamento;
- downloads e relatórios devem registrar filtros, horário e usuário gerador.

## 10. Execução deste briefing

Esta rodada executou o núcleo P0 que não depende de homologação externa:

- [x] valores monetários convertidos diretamente para centavos, sem `float64`;
- [x] fechamento e reabertura auditada de competência, com bloqueio no caso de uso e
  triggers SQLite;
- [x] estorno transacional idempotente, com movimento inverso, reabertura de título/parcela,
  auditoria e outbox;
- [x] outbox com lease, retentativa exponencial e dead-letter em
  `internal/infrastructure/financeirooutbox`;
- [x] tela do Financeiro com fechamento mensal, consulta de movimentos e justificativa de
  estorno;
- [x] testes de integração das invariantes, fechamento, estorno e outbox.

Permanece deliberadamente desacoplada a publicação externa da outbox. O processador recebe um
adaptador `Publicador`; banco, e-mail, CNAB, PIX e SEFAZ só devem ser ligados depois de definidos
provedor, credenciais, homologação e política de retry. Rateios múltiplos, lotes bancários,
OFX/CSV, DRE e orçamento continuam no backlog P1/P2 acima.
