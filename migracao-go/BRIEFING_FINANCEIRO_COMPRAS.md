# Financeiro e Compras — auditoria de código e backlog para completar

> Este documento audita o código real de `internal/domain|application|handlers|infrastructure`
> em `financeiro/`, `compras/` e `financeirocompras/` contra o que já está descrito em
> [financeiro/BRIEFING.md](financeiro/BRIEFING.md), [financeiro/ABAS_E_AUTOMACOES.md](financeiro/ABAS_E_AUTOMACOES.md)
> e [compras/COMPORTAMENTO.md](compras/COMPORTAMENTO.md), e prioriza o que falta para os dois
> módulos — e a integração entre eles — ficarem completos. Não duplica o que os documentos
> acima já descrevem bem; só confirma o que está implementado, aponta divergência e lista o
> que falta, com caminho de arquivo.

## 1. O que já funciona de verdade (não é só schema/rascunho)

**Financeiro** — título/parcela, baixa idempotente com reabertura de parcial, faturamento com
cálculo de líquido, importação do XML Sebrae com validação de chave/dígito, outbox gravada em
transação (`internal/infrastructure/financeirocompras/local.go:66`), auditoria append-only por
trigger SQLite. Os testes de integração (`baixas_integracao_test.go`,
`operacional_integracao_test.go`) cobrem concorrência e idempotência do livro.

**Compras** — cotação com no mínimo dois fornecedores, mapa comparativo, seleção com
justificativa, fluxo de pedido com segregação solicitante/aprovador, recebimento parcial
idempotente, divergência que retém o título financeiro até resolução, devolução com baixa de
estoque validando saldo devolvível, indicadores reais em SQL (não mock) — `Indicadores` e
`ListarDesempenhoFornecedores` em
`internal/infrastructure/database/compras_processo_repositorio.go:497-517` fazem os cálculos
de lead time, economia de cotação e desempenho por fornecedor direto no banco.

**Integração Compras → Financeiro** — `financeirocompras.Local.CriarTituloCompra`
(`internal/infrastructure/financeirocompras/local.go`) é idempotente por
`origem_modulo/origem_tipo/origem_id` e roda dentro de uma transação que cria título, parcela,
documento fiscal (se houver NF) e evento de outbox juntos. Isso é sólido — é o único ponto do
código hoje que de fato materializa a "dupla escrita" que o BRIEFING do Financeiro pede.

## 2. Gaps confirmados por módulo

### 2.1 Financeiro — estado atual do P0

O documento original do Financeiro foi atualizado depois desta auditoria. A conferência atual
encontra os controles de integridade implementados; permanece pendente apenas o perfil de acesso
financeiro dedicado e a publicação externa dos eventos.

| Item do P0 | Situação real |
|---|---|
| Outbox consumida | **Implementado** em `internal/infrastructure/financeirooutbox/processador.go`, com lease, retentativa e dead-letter. Publicadores externos (banco, e-mail, CNAB/PIX e SEFAZ) ainda não estão configurados. |
| Fechamento bloqueando retroatividade | **Implementado** pela migration `0010_financeiro_controles.sql`, repositório de fechamentos e validações transacionais. |
| Perfis financeiros separados | **Pendente**: `CriarTitulo`/`AprovarTitulo`/baixa ainda usam os papéis genéricos de identidade; falta cargo/permissão de tesouraria dedicado. |
| Estorno transacional | **Implementado** com movimento inverso idempotente, vínculo `movimento_original_id` e reabertura de parcela. |

### 2.2 Financeiro — gaps que o BRIEFING.md ainda **não lista** explicitamente

- **Rateio, categoria e centro de custo são schema morto.** `financeiro_categorias`,
  `financeiro_centros_custo` e `financeiro_rateios` foram criadas na migration 0007, mas
  nenhum `.go` faz `INSERT`/`SELECT` nelas. Sem isso não existe DRE por obra nem orçado x
  realizado — que o próprio §3.5 promete. É pré-requisito de infraestrutura antes de qualquer
  tela de gestão.
- **Conciliação bancária é schema morto.** `financeiro_extrato_linhas` e
  `financeiro_conciliacoes` também não são tocadas por código Go. OFX/CSV do §3.4 ainda não
  tem nem o import mais simples.
- **Sem filtro nem paginação nas listagens.** `OperacaoRepositorio.ListarTitulos(ctx, tipo)`
  (`internal/domain/financeiro/operacional.go:48`) devolve todos os títulos abertos e fechados
  de uma vez — sem intervalo de data, contraparte ou paginação. Em poucos meses de uso real a
  tela de Contas a pagar/receber vira uma tabela enorme e lenta.
- **Dashboard não mostra posição por conta bancária**, só o agregado
  `ResumoOperacional` — o P1 item 2 do próprio BRIEFING já cobra isso, reforçando aqui.

### 2.3 Compras — gaps que `compras/COMPORTAMENTO.md` não expõe porque descreve o fluxo, não o que falta

- **Sem controle de acesso por módulo — é o gap mais sério.** `identidade.Modulos`
  (`internal/domain/identidade/usuario.go:57`) lista `Painel, RH, Estoque, Alojamentos, Frota,
  Financeiro` — **não existe `ModuloCompras`**. Os handlers de compras só chamam
  `Sessoes.ExigirSessao` (`internal/handlers/compras/compras.go:42` e
  `internal/handlers/compras/processo.go`), sem nenhum `identidade.TemAcesso`. Qualquer
  usuário autenticado no sistema — inclusive cargo `CONSULTA` de outro módulo — hoje acessa,
  cria cotação, aprova pedido (se o cargo permitir) e vê indicadores de Compras. Todos os
  outros seis módulos têm esse gate; Compras é a exceção.
- **Compras ainda não usa a casca compartilhada.** Assim como o Financeiro tinha antes desta
  sessão, `internal/handlers/compras/compras.go:64` e
  `internal/handlers/compras/processo.go:17` renderizam via `html/template` com HTML própria,
  sem `layout.Base` — logo sem sidebar, sem header, sem hub flutuante. Confirma que não é só
  um problema do Financeiro: é um padrão que o Codex repetiu nos dois módulos novos.
- **"Próxima geração" de contrato é só um campo, não um job.**
  `Contrato.ProximaGeracao` (`internal/domain/compras/compras.go:236`) é gravado em
  `CriarContrato` (`internal/application/compras/complementos.go:171-205`), mas nada lê essa
  data para gerar o próximo pedido automaticamente. O contrato recorrente do §fluxo item 9 do
  COMPORTAMENTO.md é hoje só um lembrete visual.
- **Devolução não gera nenhum ajuste financeiro.** `CriarDevolucao`
  (`internal/application/compras/complementos.go:105-170`) baixa o estoque corretamente, mas
  não cria estorno nem nota de crédito no título já materializado pelo recebimento. Se a
  mercadoria já foi paga antes da devolução, o Financeiro nunca fica sabendo — o título
  permanece com o valor cheio.
- **Sem paginação/filtro nas listagens** (`ListarCotacoes`, `ListarContratos`,
  `ListarDevolucoes` em `internal/domain/compras/compras.go:261-283`) — mesmo problema do
  Financeiro, mesma origem (interfaces sem parâmetro de intervalo/página).
- **Documento anexado é `TEXT` direto na tabela** (`Documento.Conteudo` em
  `internal/domain/compras/compras.go:207-212`, limite de 8 MB aplicado só em
  `AnexarDocumento`). Funciona para o volume atual, mas cresce o banco SQLite sem limite e sem
  nenhuma validação de tipo de arquivo além do tamanho.

## 3. Backlog priorizado para completar os dois módulos

Une o P0/P1/P2 que já existe em `financeiro/BRIEFING.md` §9 com o equivalente para Compras
(que ainda não tinha um). Ordem pensada para não desperdiçar trabalho: itens de acesso e
integridade financeira vêm antes de telas novas.

### P0 — ainda bloqueia uso real com dinheiro de verdade

1. **Criar `identidade.ModuloCompras`** e aplicar `identidade.TemAcesso` em todos os handlers
   de `internal/handlers/compras`, igual ao padrão de Estoque/RH/Financeiro. Sem isso o módulo
   não deveria ir para produção — qualquer sessão vê e opera Compras.
2. **Devolução de Compras gera estorno no Financeiro** quando o recebimento já tiver título
   materializado — fecha o ciclo compra → recebimento → pagamento → devolução.
3. **Perfis financeiros dedicados** (tesouraria separada de aprovação) antes de qualquer dado
   bancário real trafegar pelo sistema.

### P1 — completar o que já está pela metade

1. **Casca compartilhada em Compras** — trocar `html/template` por `.templ` com
   `layout.Base`, mesmo trabalho já feito no Financeiro/Alojamentos nesta sessão; adicionar
   seção "Compras" na sidebar (`templates/layout/sidebar.templ`) atrás do novo
   `ModuloCompras`.
2. **Categoria, centro de custo e rateio no fluxo real** — pelo menos gravar rateio ao criar
   título (mesmo que 100% em uma categoria/obra por padrão), para destravar DRE por obra.
3. **Job de geração de contrato recorrente** — ler `compras_contratos` com
   `proxima_geracao <= hoje`, criar o próximo pedido/cotação e avançar a data.
4. **Filtro por data/status e paginação** nas listagens de título, cotação, contrato e
   devolução — mesma interface, adicionar parâmetros de intervalo.
5. **Conciliação bancária mínima** (import CSV/OFX manual, hash de deduplicação, match exato)
   — já tem tabela pronta desde a migration 0007.
6. **Dashboard financeiro por conta bancária**, não só o agregado.

### P2 — gestão e escala (mantém o que já estava no BRIEFING do Financeiro)

Segue igual ao §9 P2 do `financeiro/BRIEFING.md` (contas a receber com régua de cobrança,
CNAB/API bancária homologada, DRE gerencial, retenções fiscais) — some a esse escopo, para
Compras: relatórios exportáveis (CSV/PDF) e anexos migrados de coluna `TEXT` para blob/arquivo
com validação de tipo.

## 4. Risco se qualquer um dos dois for para produção como está hoje

Compras sem `ModuloCompras` é o bloqueador imediato — é uma falha de controle de acesso, não
apenas uma funcionalidade faltando. A devolução sem ajuste financeiro e a ausência de perfis de
tesouraria continuam riscos para uso com dinheiro real. Os demais controles P0 do Financeiro
(idempotência, fechamento, outbox e estorno) já estão cobertos por código e testes; a publicação
externa dos eventos permanece deliberadamente desligada até os adaptadores serem configurados.
