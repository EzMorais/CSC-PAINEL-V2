# Revisão especialista dos setores e dados do ERP

> Revisão baseada no banco, rotas e contratos funcionais existentes em 11/08/2026. Este
> documento complementa o `BRIEFING_ERP_CONSTRUTORA.md` e distingue dado existente, lacuna e
> origem correta. “Necessário” não significa que a função já esteja implementada.

## 1. Diagnóstico executivo

O sistema já registra bem pessoas, locações, materiais, compras, recebimentos, títulos,
alojamentos e programação. A principal lacuna estrutural é que esses registros ainda não
convergem totalmente para uma unidade gerencial comum: **obra + centro de custo + etapa/serviço**.

Sem esse eixo, a empresa sabe que comprou, pagou ou movimentou, mas não consegue responder com
segurança quanto cada serviço consumiu, se o custo acompanha o avanço físico ou qual setor está
segurando uma entrega.

### Lacunas transversais críticas

| Lacuna | Impacto | Origem correta | Consumidores |
|---|---|---|---|
| Obra sem orçamento/EAP | não existe previsto x realizado | Engenharia/Orçamento | Compras, Estoque, Financeiro, Diretoria |
| Centro de custo não percorre o fluxo | despesas ficam sem classificação | solicitação/contrato | Compras e Financeiro |
| Cadastros paralelos de pessoas e veículos | conflito de disponibilidade e duplicidade | RH e Frota | Programação, Alojamentos, Obra |
| Matriz documental sem controle individual | cargo define exigência, mas não comprova atendimento | RH/SST | Programação e gestores |
| Fornecedor com cadastro fiscal insuficiente | risco fiscal, pagamento e homologação | Suprimentos/Fiscal | Compras e Financeiro |
| Sem gestão de projetos, qualidade e medições | ERP cobre apoio, mas não a produção da construtora | Engenharia | Diretoria, Cliente, Financeiro |
| Pendências ficam dentro de telas setoriais | próximo setor não recebe fila/SLA | evento do módulo de origem | todos os setores |

## 2. Padrão obrigatório de dados

Todo registro transacional relevante deve ter:

- `id`, número legível e status controlado;
- empresa/filial, obra e centro de custo;
- etapa/serviço da EAP quando houver consumo ou receita;
- solicitante, responsável atual, aprovador e respectivas datas;
- competência, data do fato e data do registro;
- origem (`modulo`, `tipo`, `id`) para rastreabilidade e idempotência;
- observação estruturada, anexos versionados e histórico de alterações;
- motivo obrigatório em rejeição, cancelamento, estorno e exceção;
- prazo/SLA e prioridade quando gerar trabalho para outro setor.

Valores monetários devem usar centavos inteiros; datas devem ter fuso e padrão único; CPF,
CNPJ, placa, chave de NF e códigos devem ser normalizados antes de validar duplicidade.

## 3. Cadastro mestre de obras e engenharia

### Já existe

Código, cliente, descrição, responsável, status ativo, endereço, cidade, UF e coordenadas.

### Dados necessários

| Grupo | Campos mínimos |
|---|---|
| Identificação | nome oficial, CNPJ/CPF do contratante, filial executora, tipo de obra, contrato, objeto |
| Localização | endereço completo, coordenadas, município de incidência e inscrição da obra/CNO |
| Gestão | gerente, engenheiro responsável, fiscal do cliente, equipe, centro de custo principal |
| Prazo | data de assinatura, início previsto/real, término previsto/reprogramado/real, garantia |
| Financeiro | valor contratado, aditivos, retenções, índice de reajuste, condição de faturamento |
| Produção | EAP, unidade, quantidade, preço unitário, orçamento-base, curva ABC e cronograma físico-financeiro |
| Legal | ART/RRT, alvará, licença ambiental, apólices, CNO e validade dos documentos |

### Funções faltantes

- orçamento por composição de serviço, insumo, equipe e equipamento;
- versões de orçamento e linha de base aprovada;
- cronograma com dependências, avanço previsto/real e caminho crítico;
- diário/RDO com clima, efetivo, equipamentos, atividades, ocorrências e fotos;
- medição de cliente e subcontratado, retenções, aceite e saldo contratual;
- aditivos, pleitos, paralisações e termos de aceite/entrega;
- apropriação diária de mão de obra, material, frota e locação por serviço;
- encerramento formal da obra e período de garantia.

### Indicadores

CPI/SPI, avanço físico, margem projetada, custo comprometido, custo realizado, desvio por
serviço, produtividade, retrabalho, prazo de medição e saldo contratual.

## 4. Comercial, contratos e clientes — módulo ausente

### Dados necessários

- cliente, grupo econômico, contatos, documentos fiscais e histórico;
- oportunidade, origem, escopo, local, valor estimado, probabilidade e concorrentes;
- proposta, versão, validade, premissas, exclusões, impostos e margem;
- contrato, itens, reajuste, garantias, seguros, retenções, marcos e obrigações;
- aditivos, pleitos, comunicação formal, aceite e medição;
- contas a receber vinculadas à medição e ao contrato.

### Funções necessárias

Funil comercial, formação/aprovação de preço, versionamento de proposta, gestão contratual,
alertas de obrigação, medição/faturamento e visão de receita contratada versus realizada.

## 5. Planejamento e programação diária

### Já existe

Frentes, funções, pessoas, veículos, programação por dia, escalas, recursos, publicação e
detecção básica de conflitos.

### Dados necessários

- vínculo obrigatório da frente com obra, EAP/serviço e responsável;
- turno, horário, local de encontro, meta/quantidade planejada e instrução de trabalho;
- origem da pessoa no RH, cargo, aptidão, função do dia e custo-hora;
- origem do veículo/equipamento na Frota, disponibilidade e operador autorizado;
- recursos/materiais reservados no Estoque;
- apontamento de presença, horas normais/extras, produção executada e motivo do desvio;
- condições climáticas, restrições e ocorrência de segurança.

### Regras faltantes

- impedir, ou exigir exceção aprovada, para ASO/NR vencido, afastamento ou férias;
- impedir recurso em manutenção, documentação vencida ou escala duplicada;
- reservar material ao publicar e devolver reserva não consumida;
- transformar o realizado em apropriação de custo e alimentar o diário de obra;
- manter uma única pessoa mestre no RH, eliminando cadastro paralelo.

## 6. RH, Departamento Pessoal e SST

### Já existe

Cadastro pessoal/contratual, cargo, departamento, lotação, dependentes, eventos, treinamentos,
exames, uniforme, EPI integrado, documentos, auditorias e não conformidades. O cargo agora
possui objetivo, responsabilidades, requisitos e documentos obrigatórios.

### Dados necessários — funcionário

| Área | Campos faltantes ou que precisam ser controlados |
|---|---|
| Contrato | empresa/filial, sindicato, jornada/escala, gestor, centro de custo, experiência, eSocial |
| Pessoal | nacionalidade, naturalidade, escolaridade, PIS/NIS, CTPS, título eleitoral e reservista quando aplicável |
| Emergência | contato, parentesco e telefone |
| Benefícios | vale-transporte, alimentação, plano, custo e vigência |
| Férias/ausência | período aquisitivo, programação, afastamento, atestado, retorno e estabilidade |
| Competência | habilidade, nível, evidência, validade e avaliador |
| Documentos | tipo, número, emissão, validade, arquivo, verificação e status |

### Dados necessários — cargo e SST

- cargo ligado ao setor, CBO, descrição, responsabilidades e competências;
- matriz de risco por cargo/atividade/obra, não apenas rótulo normal/insalubre/periculoso;
- exames do PCMSO e treinamentos/NRs exigidos, periodicidade e antecedência do alerta;
- EPIs por risco/cargo, CA, periodicidade de troca e termo de entrega;
- PGR, PCMSO, LTCAT, APR, PT, DDS, inspeção, incidente e investigação;
- acidente/CAT, causa, ação corretiva, responsável e eficácia.

### Funções faltantes

- admissão guiada por checklist e bloqueio de cadastro incompleto;
- painel de aptidão por pessoa, cargo e obra;
- férias, afastamentos, ponto/apontamento e integração com folha;
- transferência com aprovação e impacto automático em alojamento/programação;
- desligamento com checklist de devolução de EPI, acesso, alojamento e patrimônio;
- assinatura/ciência e versionamento da documentação.

## 7. Almoxarifado e patrimônio

### Já existe

Material, categoria, unidade, mínimo, localização, CA, movimentações, aprovações, solicitações,
e-mail e entrega de EPI para o RH.

### Dados necessários

- múltiplos depósitos/locais e saldo por obra/local, em vez de localização textual única;
- grupo, subgrupo, NCM, marca, modelo, especificação, código de barras e item equivalente;
- lote/série, fabricação, validade e garantia quando aplicável;
- custo médio, último custo, custo de reposição e valor total;
- endereço físico (rua, prateleira, posição) e inventariante;
- estoque mínimo, máximo, ponto de pedido, lead time e fornecedor preferencial por local;
- reserva por programação/serviço, requisição e centro de custo;
- ativo imobilizado/ferramenta com patrimônio, responsável, cautela, estado e manutenção.

### Funções faltantes

- inventário cíclico com contagem cega, divergência e aprovação;
- transferência entre depósitos com saída em trânsito e confirmação de entrada;
- reserva e separação por programação;
- rastreio de ferramenta/patrimônio entregue ao funcionário;
- sugestão automática de compra considerando reservado, disponível e prazo;
- consumo e perdas apropriados na obra/EAP.

## 8. Suprimentos, compras e fornecedores

### Já existe

Solicitação, cotação, propostas, mapa comparativo, pedido, alçada básica, recebimento parcial,
NF, divergência, devolução, contrato, anexos e avaliação.

### Cadastro de fornecedor necessário

Hoje nome, telefone, CNPJ e e-mail são insuficientes. Acrescentar:

- razão social, nome fantasia, inscrição estadual/municipal, regime tributário e endereço;
- contatos comercial, financeiro, fiscal e pós-venda;
- dados bancários com validação e aprovação independente;
- categorias fornecidas, regiões, prazo médio, condição padrão e limite;
- certidões, seguros, licenças, validade, homologação, bloqueio e motivo;
- avaliação por qualidade, prazo, preço, atendimento, segurança e documentação;
- sócios/partes relacionadas e declaração de conflito de interesses.

### Dados transacionais necessários

- obra, centro de custo, EAP/serviço, urgência, data necessária e justificativa;
- quantidade, especificação técnica, marca de referência/equivalência e anexos;
- orçamento disponível e saldo antes da aprovação;
- frete, impostos, desconto, moeda, reajuste e condição de pagamento;
- endereço/local de entrega, comprador e follow-up;
- aceite técnico, aceite quantitativo, inspeção, lote/série e evidências;
- contrato com vigência, teto, saldo, reajuste, garantia e próxima obrigação.

### Funções faltantes

- workflow de alçada por valor/categoria/obra e aprovação de exceção;
- equalização técnica separada da comercial;
- portal do fornecedor e trilha de negociação;
- comprometimento orçamentário ao aprovar pedido;
- job real para contrato recorrente;
- devolução gerando nota de crédito/estorno financeiro;
- homologação impedindo fornecedor irregular.

## 9. Financeiro, fiscal e controladoria

### Já existe

Contas, títulos e parcelas, baixa/estorno, faturamento, documento fiscal, importação fiscal,
outbox, fechamento de competência e tabelas iniciais de categoria, centro de custo, rateio,
extrato e conciliação.

### Dados necessários

- empresa/filial, contraparte mestre, documento, série, chave, emissão, entrada e competência;
- natureza financeira, categoria contábil, conta contábil, projeto/obra, centro de custo e rateio;
- impostos, bases, retenções, vencimentos, descontos, juros, multa e forma de pagamento;
- banco, agência, conta, carteira, meio, nosso número/ID bancário e comprovante;
- previsão, realizado, conciliado, fluxo de aprovação e favorecido validado;
- contrato/pedido/recebimento/medição de origem;
- orçamento, comprometido, realizado, pago e projeção.

### Funções faltantes

- plano de contas gerencial e categorias operacionais reais;
- rateio obrigatório e DRE por obra;
- orçamento financeiro e controle de disponibilidade;
- conciliação OFX/CNAB/API com regra de correspondência e exceções;
- contas a receber originadas de medição/faturamento;
- régua de cobrança, previsão de caixa e posição bancária;
- retenções e obrigações fiscais, remessa/retorno bancário;
- perfis separados para lançamento, aprovação, tesouraria e conciliação.

## 10. Frota e equipamentos

### Já existe fora do núcleo Go

Veículos, troca de motorista, manutenção, anexos, abastecimentos, autorizados e configuração.

### Dados necessários

- tipo, marca/modelo, ano, placa/chassi/Renavam, patrimônio, proprietário e contrato;
- obra/centro de custo atual, motorista/operador e período de responsabilidade;
- hodômetro/horímetro com data, origem, foto e consistência;
- combustível, capacidade, média esperada e centro de abastecimento;
- manutenção por plano, componente, periodicidade, OS, peças, mão de obra e indisponibilidade;
- pneus, multas, sinistros, seguro, licenciamento, IPVA e documentos com validade;
- locação de equipamento, franquia, excedente, mobilização e medição;
- custo fixo/variável, custo por km/hora e apropriação por obra/serviço.

### Funções faltantes

- integração mestre com Programação, sem recadastro de veículo;
- bloqueio por manutenção/documento e controle de operador autorizado;
- plano preventivo por km, hora e data;
- requisição de peça ligada ao Estoque/Compras;
- abastecimento com validação de média, tanque e hodômetro;
- disponibilidade, utilização, ociosidade e custo por obra.

## 11. Locações de máquinas e equipamentos

### Já existe

Descrição, fornecedor, obra, quantidade, período, preço, estado, renovação, transferência,
devolução, anexos/importação e cálculo de valor.

### Dados necessários e funções faltantes

- patrimônio/série/placa de cada unidade, não apenas quantidade agregada;
- contrato, pedido, centro de custo, EAP, solicitante, aprovador e operador;
- franquia de horas, horímetro inicial/final, excedente, combustível e mobilização;
- inspeção de entrega/devolução, avaria, fotos, assinatura e cobrança contestada;
- calendário de indisponibilidade/manutenção e integração com Programação;
- competência e medição mensal gerando conferência e título financeiro;
- alerta de vencimento com decisão registrada: renovar, transferir ou devolver;
- comparação custo de locar versus comprar e taxa de utilização.

## 12. Alojamentos, transporte e logística de pessoal

### Já existe

Alojamento, quartos, capacidade, ocupações, rotas, pedidos, programações e WhatsApp.

### Dados necessários

- contrato do imóvel, proprietário, vigência, aluguel, caução, contas e centro de custo;
- endereço completo, responsável, regras, inventário, vistoria, fotos e licenças;
- quarto/leito individual, sexo/restrição quando aplicável, estado e bloqueio;
- ocupação com obra, motivo, check-in/out previsto e real, responsável e assinatura;
- manutenção com categoria, prioridade, SLA, custo, fornecedor e evidência;
- rota com veículo da Frota, motorista, pontos, horários, capacidade e passageiros;
- rateio de aluguel, utilidades, transporte e manutenção por obra/pessoa.

### Funções faltantes

- alerta de capacidade, contrato e documento;
- sincronização de admissão, transferência, férias e desligamento do RH;
- check-in/out com vistoria e inventário;
- pedido convertido em manutenção/Compra com acompanhamento;
- custo por morador/obra e taxa de ocupação.

## 13. Qualidade — módulo ausente/parcial no RH

Auditoria e não conformidade existem dentro de RH/SST, mas a construtora precisa de gestão da
qualidade da obra:

- plano de inspeção e testes por serviço;
- FVS/FVM, critérios, amostragem, responsável e evidência;
- recebimento técnico de materiais com laudos e certificados;
- controle de projeto/revisão e distribuição de cópia válida;
- não conformidade, causa, correção, ação corretiva, prazo e verificação de eficácia;
- calibração de instrumento e rastreabilidade;
- entrega, as built, manual, termo de aceite e assistência técnica.

Indicadores: aprovação na primeira inspeção, retrabalho, NC por serviço/fornecedor, prazo de
tratamento e custo da não qualidade.

## 14. TI, acessos e governança

### Já existe

Usuário, cargo sistêmico, módulos liberados, ativação, senha e registro de acesso.

### Dados e funções necessários

- perfil por ação, obra e limite de valor, além do acesso amplo ao módulo;
- vínculo entre usuário e funcionário, gestor e empresa/filial;
- segregação de funções incompatíveis e revisão periódica de acesso;
- MFA para perfis críticos, política de sessão e revogação;
- auditoria de criação, alteração, aprovação, exportação e acesso a dado sensível;
- fila de integração, monitoramento, retentativa e painel de falhas;
- política de backup, restauração testada, retenção, LGPD e descarte;
- catálogo de integrações e dono de cada dado mestre.

## 15. Gestão de pendências entre setores

Criar uma caixa de trabalho transversal, derivada dos eventos existentes:

| Evento | Pendência gerada | Responsável | Conclusão |
|---|---|---|---|
| necessidade de material aprovada | realizar cotação | Compras | pedido emitido |
| pedido entregue | conferir quantidade/qualidade | Almoxarifado/Obra | aceite ou divergência |
| recebimento aceito | validar fiscal e programar pagamento | Fiscal/Financeiro | título aprovado |
| admissão/transferência | alojar, equipar e programar | Alojamento/Estoque/Programação | checklists concluídos |
| documento próximo do vencimento | renovar/reciclar | RH/SST/Frota/Suprimentos | novo documento validado |
| locação próxima do fim | renovar/transferir/devolver | Gestor/Compras | decisão executada |
| não conformidade | corrigir e provar eficácia | dono da ação | verificação aprovada |

Cada pendência precisa de origem, responsável, prazo, prioridade, status, comentário, evidência
e histórico de reatribuição. A conclusão deve ocorrer pelo fato de negócio, não por um botão
solto de “marcar como concluído”.

## 16. Ordem de implantação recomendada

### P0 — tornar os dados confiáveis

1. Definir mestre de obra, centro de custo e EAP e torná-los obrigatórios no fluxo de despesa.
2. Unificar pessoas e veículos de Programação com RH e Frota.
3. Completar fornecedor fiscal/bancário/documental e criar homologação.
4. Materializar matriz de documentos por cargo em exigências individuais com validade.
5. Implementar rateio, segregação financeira e reflexo financeiro das devoluções.
6. Criar trilha transversal de pendências e eventos.

### P1 — controlar produção e resultado

1. Orçamento e cronograma físico-financeiro por EAP.
2. Diário de obra, apropriação, medição e qualidade.
3. Estoque por local/obra, reserva e inventário.
4. Conciliação e DRE por obra.
5. Frota integrada com custo e disponibilidade.

### P2 — escala e automação

1. Portais de campo, fornecedor e cliente.
2. Assinatura eletrônica e gestão documental central.
3. Previsões de caixa, compra, produtividade e manutenção.
4. BI executivo com indicadores certificados e fechamento mensal.

## 17. Critério de “setor completo”

Um setor só deve ser considerado completo quando:

- possui cadastro mestre sem duplicação;
- registra o processo do início ao fim e suas exceções;
- recebe dados de origem, sem redigitação;
- entrega um evento/documento consumível pelo próximo setor;
- possui alçada, segregação, auditoria e anexos;
- possui alertas, fila de pendências e SLA;
- produz indicadores reconciliáveis com os registros;
- tem testes do fluxo feliz, rejeição, cancelamento, duplicidade e concorrência;
- possui responsável de negócio pelo dado e política de correção.
