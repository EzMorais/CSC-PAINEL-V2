# Compras — contrato funcional

Este documento registra o fluxo implementado no servidor Go e serve como referência para
operação, manutenção e testes automatizados.

## Fluxo de ponta a ponta

1. Uma solicitação do Almoxarifado em `ENVIADA` ou `ATENDIDA` abre uma cotação com pelo
   menos dois fornecedores ativos.
2. Cada proposta guarda itens em centavos, frete, prazo, previsão, condição, validade,
   marca, observação e documento de apoio. O mapa comparativo ordena pelo custo total.
3. A escolha registra a proposta vencedora e uma justificativa. O pedido nasce
   `RASCUNHO`, pode ser editado e mantém a relação com solicitação, cotação e fornecedor.
4. O fluxo do pedido é `RASCUNHO → PENDENTE_APROVACAO → APROVADO → ENVIADO →
   PARCIAL/RECEBIDO`. Rejeição e cancelamento preservam o histórico. O solicitante não
   aprova o próprio pedido.
5. O recebimento aceita entregas parciais e usa uma chave idempotente. Uma retentativa não
   duplica recebimento, estoque, conta a pagar nem título financeiro.
6. A conferência compara quantidade física, quantidade da nota, valor unitário e total da
   nota. Diferenças criam ocorrências explícitas. Somente gerência/diretoria/admin decide,
   sempre com justificativa.
7. Recebimento conferido gera entrada no estoque, conta a pagar legada e título no novo
   Financeiro. Se houver divergência, o título novo fica retido até todas as diferenças
   serem aceitas; uma recusa marca a conferência como recusada.
8. Devolução valida fornecedor, recebimento, itens e saldo ainda devolvível, grava o fato e
   baixa a quantidade correspondente do estoque.
9. Contratos registram vigência, limite, periodicidade, condição e próxima geração para
   acompanhamento operacional.
10. A conclusão permite avaliar prazo, qualidade e atendimento do fornecedor.

## Controles

- Numeração anual: `COT-AAAA-NNNN`, `CP-AAAA-NNNN`, `REC-AAAA-NNNN`,
  `DEV-AAAA-NNNN` e `CPA-AAAA-NNNN`.
- Valores de proposta, nota e novo Financeiro são persistidos em centavos.
- Chave de NF-e e chave de idempotência são únicas quando informadas.
- Eventos de aprovação e cancelamento são append-only no banco.
- Documentos são referências rastreáveis associadas ao pedido ou à cotação.
- Exclusão física de pedidos, divergências e eventos não faz parte do fluxo operacional.

## Visões disponíveis

- pedidos, detalhes, edição, aprovação, envio, recebimento e avaliação;
- cotações, propostas, mapa comparativo e anexos;
- divergências e decisão gerencial;
- devoluções e baixa de estoque;
- contratos;
- indicadores de pendências, atrasos, total comprado, economia, lead time e desempenho
  por fornecedor.

## Cobertura automatizada

Os testes de aplicação cobrem pedido, recebimento parcial/completo, limite de quantidade,
idempotência fiscal, divergências, estoque e contas. O teste integrado cobre cotação,
comparação, seleção, segregação de aprovação e envio. A integração com o Financeiro testa
criação de título, parcela e outbox sem duplicação.
