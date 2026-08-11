# Financeiro — abas e automações

## Separação de responsabilidades

### Financeiro

É o cockpit: mostra valores a pagar/receber, vencidos, faturamento do mês, documentos
fiscais pendentes ou rejeitados, contas bancárias/caixa e situação dos conectores.

### Faturamento

Representa a venda antes da liquidação. Guarda cliente, produto/serviço, emissão,
vencimento, descontos, acréscimos e documento fiscal pretendido. Ao finalizar:

1. cria uma conta a receber e sua parcela;
2. cria o documento fiscal pendente, quando aplicável;
3. grava um evento idempotente `FISCAL_EMISSAO_SOLICITADA` na outbox;
4. mantém o vínculo faturamento → título → documento fiscal.

Faturamento não é sinônimo de nota fiscal nem de recebimento bancário.

### Fiscal / SEFAZ

- NF-e de mercadorias (modelo 55) segue autorização da SEFAZ e os leiautes do Portal
  Nacional da NF-e.
- NFS-e de serviços segue o padrão nacional/município competente.
- autorização, rejeição e cancelamento são estados persistidos; XML, chave, protocolo,
  ambiente e mensagem de rejeição permanecem rastreáveis.
- notas de entrada capturadas em Compras aparecem na mesma central fiscal.

O conector nunca deve inventar autorização. Sem certificado, credenciamento e homologação,
o documento permanece pendente em ambiente de homologação.

### Emissor Sebrae legado

O aplicativo 4.01 antigo é tratado apenas como origem de migração. A importação lê o XML
autorizado, valida chave de 44 dígitos, destinatário, emissão e total, e cria uma única vez:

- o registro fiscal autorizado;
- o faturamento histórico;
- a conta a receber correspondente.

O Sebrae hoje oferece um emissor web, em substituição ao 4.01. Mesmo assim, o núcleo deste
sistema não fica acoplado ao Sebrae: qualquer emissor deve conversar pela fronteira fiscal.

### Contas a pagar

Recebe títulos automáticos de Compras e lançamentos manuais. Lançamento manual nasce
pendente, outra pessoa aprova e a baixa exige uma conta financeira. Pagamentos parciais e
integrais atualizam título/parcela dentro da mesma transação e usam chave idempotente.

### Contas a receber

Recebe automaticamente o título do faturamento e também aceita lançamentos manuais. A
baixa segue o mesmo livro imutável, mas gera movimento de recebimento.

## Regras de automação

- dinheiro em centavos;
- idempotência no faturamento, XML fiscal, origem de título e baixa;
- solicitante não aprova o próprio lançamento manual;
- fatos financeiros e auditoria são append-only;
- emissão fiscal é assíncrona por outbox;
- rejeição não gera uma falsa autorização e continua visível para correção;
- certificado digital e senhas não são armazenados nessas tabelas — somente referência a
  segredo externo;
- produção fiscal exige homologação específica da empresa, UF, município e contador.

## Adequação 2026

Os esquemas fiscais devem ser versionados no conector. A Receita Federal orienta que os
documentos eletrônicos de 2026 contemplem CBS e IBS conforme as notas técnicas próprias. O
Portal da NF-e já publica notas técnicas da Reforma Tributária e o Portal Nacional da NFS-e
mantém manuais e APIs próprios. Portanto, regras tributárias não ficam codificadas na tela
financeira; pertencem ao adaptador fiscal versionado.

Referências oficiais:

- [Portal Nacional da NF-e — notas técnicas](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=)
- [Receita Federal — orientações da Reforma Tributária para 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [Portal Nacional da NFS-e — documentação](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica)
- [Sebrae — novo emissor web](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/produtoseservicos/emissornfe)

## Pendência externa para transmissão real

A aplicação e a fila estão prontas para receber um conector, mas transmitir em produção
depende de dados que não podem ser presumidos: CNPJ/IE, UF, regime tributário, certificado
ICP-Brasil, município/padrão NFS-e, séries, CSC quando aplicável e validação do contador. Até
essa homologação, o sistema opera com importação do Sebrae e registro do retorno do conector.
