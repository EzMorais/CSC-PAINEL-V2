ALTER TABLE compras_pedidos ADD COLUMN solicitante_id TEXT;
ALTER TABLE compras_pedidos ADD COLUMN solicitante_nome TEXT;
ALTER TABLE compras_pedidos ADD COLUMN aprovador_id TEXT;
ALTER TABLE compras_pedidos ADD COLUMN aprovador_nome TEXT;
ALTER TABLE compras_pedidos ADD COLUMN aprovado_em TEXT;
ALTER TABLE compras_pedidos ADD COLUMN enviado_em TEXT;
ALTER TABLE compras_pedidos ADD COLUMN previsao_entrega TEXT;
ALTER TABLE compras_pedidos ADD COLUMN condicao_pagamento TEXT;
ALTER TABLE compras_pedidos ADD COLUMN cotacao_id TEXT;
ALTER TABLE compras_pedidos ADD COLUMN motivo_escolha TEXT;
ALTER TABLE compras_pedidos ADD COLUMN cancelado_em TEXT;
ALTER TABLE compras_pedidos ADD COLUMN cancelado_por TEXT;
ALTER TABLE compras_pedidos ADD COLUMN motivo_cancelamento TEXT;

-- Pedidos criados pelo MVP anterior já eram imediatamente executáveis; na evolução
-- passam a APROVADO para preservar essa verdade, enquanto pedidos novos nascem RASCUNHO.
UPDATE compras_pedidos SET status='APROVADO' WHERE status='ABERTO';

CREATE TABLE compras_cotacoes (
 id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE,
 solicitacao_id TEXT NOT NULL REFERENCES solicitacoes_compra(id),
 status TEXT NOT NULL CHECK(status IN ('ABERTA','EM_ANALISE','SELECIONADA','CANCELADA')),
 prazo_resposta TEXT, observacao TEXT, solicitante_id TEXT NOT NULL, solicitante_nome TEXT NOT NULL,
 criado_em TEXT NOT NULL, encerrado_em TEXT
);
CREATE INDEX idx_compras_cotacoes_status ON compras_cotacoes(status,criado_em DESC);

CREATE TABLE compras_cotacao_fornecedores (
 cotacao_id TEXT NOT NULL REFERENCES compras_cotacoes(id) ON DELETE CASCADE,
 fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id), convidado_em TEXT NOT NULL,
 respondeu_em TEXT, PRIMARY KEY(cotacao_id,fornecedor_id)
);

CREATE TABLE compras_propostas (
 id TEXT PRIMARY KEY, cotacao_id TEXT NOT NULL REFERENCES compras_cotacoes(id) ON DELETE CASCADE,
 fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id), fornecedor_nome TEXT NOT NULL,
 valor_itens_centavos INTEGER NOT NULL CHECK(valor_itens_centavos >= 0),
 frete_centavos INTEGER NOT NULL DEFAULT 0 CHECK(frete_centavos >= 0),
 total_centavos INTEGER NOT NULL CHECK(total_centavos > 0), prazo_dias INTEGER,
 previsao_entrega TEXT, condicao_pagamento TEXT, validade TEXT, observacao TEXT,
 anexo TEXT, selecionada INTEGER NOT NULL DEFAULT 0, registrado_por TEXT NOT NULL,
 criado_em TEXT NOT NULL, UNIQUE(cotacao_id,fornecedor_id)
);
CREATE TABLE compras_proposta_itens (
 id TEXT PRIMARY KEY, proposta_id TEXT NOT NULL REFERENCES compras_propostas(id) ON DELETE CASCADE,
 material_id TEXT NOT NULL REFERENCES materiais(id), quantidade REAL NOT NULL CHECK(quantidade>0),
 valor_unitario_centavos INTEGER NOT NULL CHECK(valor_unitario_centavos>=0),
 marca TEXT, observacao TEXT, UNIQUE(proposta_id,material_id)
);

CREATE TABLE compras_documentos (
 id TEXT PRIMARY KEY, pedido_id TEXT REFERENCES compras_pedidos(id) ON DELETE CASCADE,
 cotacao_id TEXT REFERENCES compras_cotacoes(id) ON DELETE CASCADE,
 tipo TEXT NOT NULL CHECK(tipo IN ('PROPOSTA','PEDIDO','NOTA_FISCAL','COMPROVANTE','OUTRO')),
 nome TEXT NOT NULL, conteudo TEXT NOT NULL, registrado_por TEXT NOT NULL, criado_em TEXT NOT NULL,
 CHECK((pedido_id IS NOT NULL) <> (cotacao_id IS NOT NULL))
);

ALTER TABLE compras_recebimentos ADD COLUMN chave_idempotencia TEXT;
ALTER TABLE compras_recebimentos ADD COLUMN data_emissao_nf TEXT;
ALTER TABLE compras_recebimentos ADD COLUMN chave_nf TEXT;
ALTER TABLE compras_recebimentos ADD COLUMN valor_nf_centavos INTEGER;
ALTER TABLE compras_recebimentos ADD COLUMN status_conferencia TEXT NOT NULL DEFAULT 'CONFERIDO';
CREATE UNIQUE INDEX idx_compras_recebimentos_idempotencia ON compras_recebimentos(chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
CREATE UNIQUE INDEX idx_compras_recebimentos_chave_nf ON compras_recebimentos(chave_nf) WHERE chave_nf IS NOT NULL;

ALTER TABLE compras_recebimento_itens ADD COLUMN quantidade_nf REAL;
ALTER TABLE compras_recebimento_itens ADD COLUMN valor_nf_unitario_centavos INTEGER;

CREATE TABLE compras_divergencias (
 id TEXT PRIMARY KEY, recebimento_id TEXT NOT NULL REFERENCES compras_recebimentos(id) ON DELETE CASCADE,
 pedido_item_id TEXT REFERENCES compras_pedido_itens(id), tipo TEXT NOT NULL,
 esperado TEXT NOT NULL, encontrado TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('PENDENTE','ACEITA','RECUSADA')),
 resolvido_por TEXT, resolvido_em TEXT, justificativa TEXT, criado_em TEXT NOT NULL
);

CREATE TABLE compras_devolucoes (
 id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE, recebimento_id TEXT NOT NULL REFERENCES compras_recebimentos(id),
 fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id), motivo TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('REGISTRADA','ENVIADA','CONCLUIDA','CANCELADA')),
 registrado_por TEXT NOT NULL, criado_em TEXT NOT NULL, concluido_em TEXT
);
CREATE TABLE compras_devolucao_itens (
 id TEXT PRIMARY KEY, devolucao_id TEXT NOT NULL REFERENCES compras_devolucoes(id) ON DELETE CASCADE,
 material_id TEXT NOT NULL REFERENCES materiais(id), quantidade REAL NOT NULL CHECK(quantidade>0),
 valor_unitario_centavos INTEGER NOT NULL CHECK(valor_unitario_centavos>=0)
);

CREATE TABLE compras_contratos (
 id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE, fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id),
 fornecedor_nome TEXT NOT NULL, objeto TEXT NOT NULL, inicio TEXT NOT NULL, fim TEXT,
 valor_limite_centavos INTEGER CHECK(valor_limite_centavos>0), valor_consumido_centavos INTEGER NOT NULL DEFAULT 0,
 periodicidade TEXT CHECK(periodicidade IN ('UNICA','SEMANAL','MENSAL','TRIMESTRAL','ANUAL')),
 proxima_geracao TEXT, condicao_pagamento TEXT, ativo INTEGER NOT NULL DEFAULT 1,
 observacao TEXT, criado_por TEXT NOT NULL, criado_em TEXT NOT NULL
);

CREATE TABLE compras_avaliacoes_fornecedor (
 id TEXT PRIMARY KEY, fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id), pedido_id TEXT REFERENCES compras_pedidos(id),
 prazo INTEGER NOT NULL CHECK(prazo BETWEEN 1 AND 5), qualidade INTEGER NOT NULL CHECK(qualidade BETWEEN 1 AND 5),
 atendimento INTEGER NOT NULL CHECK(atendimento BETWEEN 1 AND 5), observacao TEXT,
 avaliado_por TEXT NOT NULL, criado_em TEXT NOT NULL, UNIQUE(fornecedor_id,pedido_id)
);

CREATE TABLE compras_eventos (
 id TEXT PRIMARY KEY, agregado_tipo TEXT NOT NULL, agregado_id TEXT NOT NULL, tipo TEXT NOT NULL,
 ator_id TEXT, ator_nome TEXT, detalhe TEXT, criado_em TEXT NOT NULL
);
CREATE INDEX idx_compras_eventos_agregado ON compras_eventos(agregado_tipo,agregado_id,criado_em);

CREATE TRIGGER compras_eventos_sem_update BEFORE UPDATE ON compras_eventos
BEGIN SELECT RAISE(ABORT,'evento de compras é imutável'); END;
CREATE TRIGGER compras_eventos_sem_delete BEFORE DELETE ON compras_eventos
BEGIN SELECT RAISE(ABORT,'evento de compras não pode ser excluído'); END;
