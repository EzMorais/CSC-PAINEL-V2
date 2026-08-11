# Briefing funcional — ERP integrado para construtora

> A revisão detalhada de campos, funções e lacunas de todos os setores está em
> [REVISAO_SETORES_E_DADOS_ERP.md](REVISAO_SETORES_E_DADOS_ERP.md).

## Objetivo

Transformar o CSC Painel de um conjunto de telas setoriais em um fluxo único de operação. A
obra é o centro de custo e o eixo comum; funcionário, fornecedor, material, equipamento,
contrato e título financeiro devem manter vínculo com a obra e uma trilha de auditoria.

O princípio é o mesmo usado por ERPs de construção: cada setor registra o fato pelo qual é
responsável e o sistema entrega esse fato ao próximo setor. Não se redigita pedido, nota,
funcionário ou movimentação em outro módulo.

## Fluxo intersetorial prioritário

| Etapa | Dono | Entrada | Saída obrigatória | Próximo setor |
|---|---|---|---|---|
| Planejar serviço | Engenharia/Obra | contrato, orçamento, cronograma | frente, data, equipe e insumos previstos | Programação e Compras |
| Mobilizar equipe | RH/SST | necessidade de mão de obra | funcionário apto, ASO, treinamentos e EPIs válidos | Programação/Obra |
| Solicitar material | Obra/Almoxarifado | atividade planejada e saldo | requisição com obra, centro de custo e aprovador | Compras |
| Cotar e contratar | Compras | requisição aprovada | mapa de cotação, pedido/contrato e prazo | Fornecedor/Recebimento |
| Receber | Almoxarifado/Obra | pedido de compra | entrada, aceite ou divergência, evidência e NF | Financeiro/Compras |
| Pagar | Financeiro | recebimento aceito + documento fiscal | título, rateio por obra e baixa conciliada | Controladoria |
| Executar e medir | Obra/Engenharia | equipe e insumos liberados | avanço físico, consumo e medição | Financeiro/Diretoria |
| Encerrar | Engenharia/Financeiro/RH | medição final e desmobilização | aceite, fechamento de custos e baixa da equipe | Diretoria |

Nenhum título de compra deve ser liberado sem recebimento; nenhuma pessoa deve entrar na
programação com documento ocupacional obrigatório vencido; nenhuma retirada de estoque deve
existir sem obra, responsável e finalidade.

## Escopo por setor

### Engenharia e Obras

- Estrutura analítica da obra (etapas, serviços e centros de custo), orçamento-base, cronograma,
  diário de obra, medição, avanço físico e apropriação de equipe/equipamento.
- Emite previsão de materiais e mão de obra para Programação, Compras, Estoque e RH.
- Documentos: contrato, projetos/revisões, ART/RRT, alvarás, diário, RDO, medições, aceite e
  evidências fotográficas.

### Programação diária

- Escala funcionários, veículos e equipamentos por obra/frente e registra ausências/conflitos.
- Deve consumir cadastro do RH e disponibilidade da Frota, sem manter cadastros paralelos.
- Bloqueios: funcionário inativo/inapto, recurso em manutenção ou duplicado em duas frentes.

### RH e SST

- Admissão, lotação, cargo, função, competências, exames, treinamentos, EPIs, férias,
  afastamentos e desligamento.
- Cada cargo possui objetivo, responsabilidades, requisitos e matriz de documentos obrigatórios.
- Deve publicar aptidão e disponibilidade para Programação, Alojamentos e gestores de obra.

### Almoxarifado

- Catálogo único, saldo por local/obra, lote, inventário, transferência, reserva, entrega e
  devolução. Toda saída informa obra, solicitante, centro de custo e, para EPI, funcionário.
- Ponto de reposição gera sugestão de compra; recebimento atualiza estoque e comunica aceite ou
  divergência a Compras. Entrega de EPI atualiza automaticamente a ficha do RH.

### Compras e Suprimentos

- Requisição, alçada, cotação, mapa comparativo, pedido, contrato, follow-up, recebimento,
  divergência, devolução e avaliação de fornecedor.
- O pedido herda obra/centro de custo da solicitação; o recebimento aceito cria a obrigação no
  Financeiro. Alteração de preço, prazo ou quantidade conserva histórico e aprovação.

### Financeiro e Controladoria

- Contas a pagar/receber, tesouraria, conciliação, fluxo de caixa, competência, retenções,
  rateio e DRE por obra.
- Não cadastra novamente uma compra: recebe pedido, fornecedor, NF, aceite e rateio dos módulos
  de origem. Pagamento exige segregação entre lançamento, aprovação e baixa.

### Frota e equipamentos

- Cadastro, documentação, abastecimento, horímetro, manutenção preventiva/corretiva, multas,
  pneus e custo por obra. Publica disponibilidade para Programação.
- Documentos: CRLV, seguro, CNH compatível, inspeções, ordens de serviço e comprovantes.

### Alojamentos e logística

- Capacidade por quarto, ocupação, check-in/out, rota, manutenção, vistoria e custos por obra.
- Consome funcionários ativos do RH; movimentações devem acompanhar admissão, transferência e
  desligamento, evitando morador sem vínculo ativo.

## Ficha de cargo e matriz documental

O cadastro de cargo é a fonte da verdade da função profissional, separado do perfil de acesso
ao sistema. Campos mínimos:

- nome e CBO;
- objetivo da função;
- responsabilidades e entregas;
- requisitos, experiência, competências e NRs;
- classificação de risco;
- documentos obrigatórios, com validade quando aplicável.

Exemplos de matriz inicial (validar com RH/SST e PGR/PCMSO da empresa):

| Cargo | Responsabilidades-chave | Documentos/capacitações sugeridos |
|---|---|---|
| Engenheiro de obra | planejamento, medição, qualidade, custos e equipe | CREA, ART quando aplicável, ASO e integrações |
| Mestre/encarregado | distribuir serviço, conferir execução e segurança | ASO, integração, treinamentos definidos no PGR |
| Eletricista | instalação, teste, bloqueio e liberação elétrica | ASO, NR-10 e autorizações aplicáveis |
| Operador de máquinas | inspeção, operação e apontamento de horímetro | ASO, habilitação/capacitação do equipamento e CNH quando exigida |
| Almoxarife | receber, conferir, armazenar e movimentar materiais | ASO, integração e capacitações de movimentação quando aplicáveis |
| Comprador | cotar, negociar, contratar e acompanhar entrega | política de alçada e termo de conflito de interesses |
| Técnico de segurança | inspeções, DDS, documentos e investigação | registro profissional, ASO e capacitações legais |

As exigências são parametrizáveis por cargo; o sistema não deve presumir validade legal apenas
pela presença de um arquivo. RH/SST define tipo, periodicidade e regra conforme risco e atividade.

## Regras de integração

1. Identificadores mestres únicos para obra, funcionário, fornecedor, material e equipamento.
2. Eventos de negócio imutáveis: solicitado, aprovado, recebido, divergente, pago, estornado.
3. Idempotência nas integrações para uma ação não gerar duas entradas, fichas ou parcelas.
4. Alçadas por valor, obra e tipo de operação, com segregação de funções.
5. Anexos versionados, com autor, data, validade e vínculo ao registro de origem.
6. Dashboard gerencial compara orçamento, comprometido, realizado, pago e avanço físico por obra.

## Prioridade de implementação

### P0 — segurança operacional

- Matriz documental por cargo e bloqueio/alerta de aptidão na Programação.
- Centro de custo/obra obrigatório de ponta a ponta em solicitação, pedido, estoque e título.
- Segregação de alçadas e trilha de auditoria.
- Devolução de compra refletida em Estoque e Financeiro.

### P1 — integração gerencial

- EAP/orçamento e apropriação por serviço.
- Conciliação bancária e DRE por obra.
- Frota fornecendo disponibilidade e custo à Programação/Obra.
- Alertas centralizados de documentos, contratos, estoque e manutenção.

### P2 — eficiência e inteligência

- Portal/aplicativo de campo para diário, fotos, recebimento e apontamento.
- Previsão de caixa e materiais baseada no cronograma.
- Indicadores de produtividade, perdas, prazo e desempenho de fornecedores.

## Critérios de aceite

- É possível rastrear uma despesa do pagamento até NF, recebimento, pedido, cotação, solicitação,
  atividade e obra.
- O gestor enxerga custo comprometido e realizado por obra sem planilha paralela.
- Programação não escala pessoa ou recurso indisponível sem exceção justificada e auditada.
- RH identifica documentos faltantes/vencidos por cargo, funcionário e obra.
- Cada setor recebe uma fila de pendências originada pelos demais módulos, com dono e prazo.
