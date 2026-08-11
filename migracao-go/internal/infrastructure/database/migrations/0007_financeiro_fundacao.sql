CREATE TABLE financeiro_contas (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('BANCO','CAIXA')),
 banco_codigo TEXT, agencia TEXT, conta TEXT, moeda TEXT NOT NULL DEFAULT 'BRL',
 saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0, data_saldo_inicial TEXT,
 ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
 UNIQUE(banco_codigo,agencia,conta)
);

CREATE TABLE financeiro_categorias (
 id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
 natureza TEXT NOT NULL CHECK(natureza IN ('RECEITA','DESPESA','TRANSFERENCIA')),
 pai_id TEXT REFERENCES financeiro_categorias(id), ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE financeiro_centros_custo (
 id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
 obra_id TEXT UNIQUE REFERENCES obras(id), ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE financeiro_titulos (
 id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE,
 tipo TEXT NOT NULL CHECK(tipo IN ('PAGAR','RECEBER')),
 contraparte_id TEXT, contraparte_nome TEXT NOT NULL, documento TEXT,
 descricao TEXT NOT NULL, emissao TEXT NOT NULL, competencia TEXT NOT NULL,
 valor_total_centavos INTEGER NOT NULL CHECK(valor_total_centavos > 0),
 valor_aberto_centavos INTEGER NOT NULL CHECK(valor_aberto_centavos >= 0 AND valor_aberto_centavos <= valor_total_centavos),
 status TEXT NOT NULL CHECK(status IN ('RASCUNHO','PENDENTE_APROVACAO','APROVADO','PARCIAL','LIQUIDADO','CANCELADO')),
 origem_modulo TEXT, origem_tipo TEXT, origem_id TEXT, criado_por TEXT,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
 UNIQUE(origem_modulo, origem_tipo, origem_id)
);
CREATE INDEX idx_fin_titulos_status ON financeiro_titulos(tipo,status,competencia);

CREATE TABLE financeiro_parcelas (
 id TEXT PRIMARY KEY, titulo_id TEXT NOT NULL REFERENCES financeiro_titulos(id), numero INTEGER NOT NULL,
 vencimento TEXT NOT NULL, valor_original_centavos INTEGER NOT NULL CHECK(valor_original_centavos > 0),
 valor_aberto_centavos INTEGER NOT NULL CHECK(valor_aberto_centavos >= 0 AND valor_aberto_centavos <= valor_original_centavos),
 status TEXT NOT NULL CHECK(status IN ('ABERTA','PARCIAL','LIQUIDADA','CANCELADA')),
 UNIQUE(titulo_id,numero)
);
CREATE INDEX idx_fin_parcelas_vencimento ON financeiro_parcelas(status,vencimento);

CREATE TABLE financeiro_rateios (
 id TEXT PRIMARY KEY, titulo_id TEXT NOT NULL REFERENCES financeiro_titulos(id),
 categoria_id TEXT NOT NULL REFERENCES financeiro_categorias(id),
 centro_custo_id TEXT REFERENCES financeiro_centros_custo(id),
 valor_centavos INTEGER NOT NULL CHECK(valor_centavos > 0), observacao TEXT
);

CREATE TABLE financeiro_movimentos (
 id TEXT PRIMARY KEY, titulo_id TEXT REFERENCES financeiro_titulos(id),
 parcela_id TEXT REFERENCES financeiro_parcelas(id), conta_id TEXT NOT NULL REFERENCES financeiro_contas(id),
 tipo TEXT NOT NULL CHECK(tipo IN ('PAGAMENTO','RECEBIMENTO','ESTORNO','JUROS','MULTA','DESCONTO','TARIFA','TRANSFERENCIA')),
 valor_centavos INTEGER NOT NULL CHECK(valor_centavos > 0), ocorrido_em TEXT NOT NULL,
 documento TEXT, observacao TEXT, movimento_original_id TEXT REFERENCES financeiro_movimentos(id),
 chave_idempotencia TEXT NOT NULL UNIQUE, registrado_por TEXT, criado_em TEXT NOT NULL
);
CREATE INDEX idx_fin_movimentos_data ON financeiro_movimentos(ocorrido_em,tipo);

CREATE TABLE financeiro_extrato_linhas (
 id TEXT PRIMARY KEY, conta_id TEXT NOT NULL REFERENCES financeiro_contas(id),
 identificador_banco TEXT, ocorrido_em TEXT NOT NULL, valor_centavos INTEGER NOT NULL CHECK(valor_centavos <> 0),
 descricao TEXT NOT NULL, hash_deduplicacao TEXT NOT NULL UNIQUE, importado_em TEXT NOT NULL,
 conciliado_em TEXT
);

CREATE TABLE financeiro_conciliacoes (
 id TEXT PRIMARY KEY, extrato_linha_id TEXT NOT NULL UNIQUE REFERENCES financeiro_extrato_linhas(id),
 movimento_id TEXT NOT NULL UNIQUE REFERENCES financeiro_movimentos(id),
 tipo TEXT NOT NULL CHECK(tipo IN ('AUTOMATICA','MANUAL')), confianca INTEGER CHECK(confianca BETWEEN 0 AND 100),
 conciliado_por TEXT, criado_em TEXT NOT NULL
);

CREATE TABLE financeiro_outbox (
 id TEXT PRIMARY KEY, tipo TEXT NOT NULL, agregado_id TEXT NOT NULL, payload_json TEXT NOT NULL,
 criado_em TEXT NOT NULL, processado_em TEXT, tentativas INTEGER NOT NULL DEFAULT 0,
 proxima_tentativa_em TEXT, ultimo_erro TEXT
);
CREATE INDEX idx_fin_outbox_pendente ON financeiro_outbox(processado_em,proxima_tentativa_em);

CREATE TABLE financeiro_auditoria (
 id TEXT PRIMARY KEY, agregado_tipo TEXT NOT NULL, agregado_id TEXT NOT NULL, acao TEXT NOT NULL,
 ator_id TEXT, ator_nome TEXT, justificativa TEXT, antes_json TEXT, depois_json TEXT,
 correlacao_id TEXT, criado_em TEXT NOT NULL
);
CREATE INDEX idx_fin_auditoria_agregado ON financeiro_auditoria(agregado_tipo,agregado_id,criado_em);

-- Livro e auditoria são append-only. Correção financeira acontece por ESTORNO, nunca
-- por UPDATE/DELETE do fato original.
CREATE TRIGGER financeiro_movimentos_sem_update BEFORE UPDATE ON financeiro_movimentos
BEGIN SELECT RAISE(ABORT,'movimento financeiro é imutável; registre um estorno'); END;
CREATE TRIGGER financeiro_movimentos_sem_delete BEFORE DELETE ON financeiro_movimentos
BEGIN SELECT RAISE(ABORT,'movimento financeiro não pode ser excluído'); END;
CREATE TRIGGER financeiro_auditoria_sem_update BEFORE UPDATE ON financeiro_auditoria
BEGIN SELECT RAISE(ABORT,'auditoria financeira é imutável'); END;
CREATE TRIGGER financeiro_auditoria_sem_delete BEFORE DELETE ON financeiro_auditoria
BEGIN SELECT RAISE(ABORT,'auditoria financeira não pode ser excluída'); END;

CREATE TABLE financeiro_fechamentos (
 id TEXT PRIMARY KEY, competencia TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('ABERTO','FECHADO')),
 fechado_em TEXT, fechado_por TEXT, reaberto_em TEXT, reaberto_por TEXT, justificativa TEXT
);

-- Converte as contas de Compras sem alterar a tabela legada nesta primeira fatia. A chave de
-- origem impede duplicidade ao reexecutar importadores futuros.
INSERT INTO financeiro_titulos
 (id,numero,tipo,contraparte_id,contraparte_nome,descricao,emissao,competencia,
  valor_total_centavos,valor_aberto_centavos,status,origem_modulo,origem_tipo,origem_id,
  criado_em,atualizado_em)
SELECT 'legado-'||id,numero,'PAGAR',fornecedor_id,fornecedor_nome,'Compra '||numero,
 substr(criado_em,1,10),substr(criado_em,1,7),round(valor_total*100),round(valor_aberto*100),
 CASE WHEN status='PAGA' THEN 'LIQUIDADO' WHEN status='PARCIAL' THEN 'PARCIAL' ELSE 'APROVADO' END,
 'COMPRAS','CONTA_PAGAR',id,criado_em,criado_em FROM contas_pagar WHERE valor_total > 0;

INSERT INTO financeiro_parcelas
 (id,titulo_id,numero,vencimento,valor_original_centavos,valor_aberto_centavos,status)
SELECT 'legado-parcela-'||id,'legado-'||id,1,substr(vencimento,1,10),round(valor_total*100),
 round(valor_aberto*100),CASE WHEN status='PAGA' THEN 'LIQUIDADA' WHEN status='PARCIAL' THEN 'PARCIAL' ELSE 'ABERTA' END
FROM contas_pagar WHERE valor_total > 0;
