CREATE TABLE financeiro_faturamentos (
 id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE, cliente_id TEXT, cliente_nome TEXT NOT NULL,
 descricao TEXT NOT NULL, tipo_operacao TEXT NOT NULL CHECK(tipo_operacao IN ('PRODUTO','SERVICO')),
 emissao TEXT NOT NULL, vencimento TEXT NOT NULL,
 valor_bruto_centavos INTEGER NOT NULL CHECK(valor_bruto_centavos > 0),
 desconto_centavos INTEGER NOT NULL DEFAULT 0 CHECK(desconto_centavos >= 0),
 acrescimo_centavos INTEGER NOT NULL DEFAULT 0 CHECK(acrescimo_centavos >= 0),
 valor_liquido_centavos INTEGER NOT NULL CHECK(valor_liquido_centavos > 0),
 modelo_fiscal TEXT NOT NULL CHECK(modelo_fiscal IN ('NFE','NFSE','SEM_NOTA')),
 emissor_fiscal TEXT NOT NULL CHECK(emissor_fiscal IN ('SEFAZ','NFSE_NACIONAL','SEBRAE_LEGADO','EXTERNO')),
 status TEXT NOT NULL CHECK(status IN ('RASCUNHO','FATURADO','CANCELADO')),
 titulo_id TEXT UNIQUE REFERENCES financeiro_titulos(id), chave_idempotencia TEXT NOT NULL UNIQUE,
 observacao TEXT, criado_por_id TEXT, criado_por_nome TEXT NOT NULL,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_fin_faturamentos_status ON financeiro_faturamentos(status,emissao);

CREATE TABLE financeiro_documentos_fiscais (
 id TEXT PRIMARY KEY, faturamento_id TEXT UNIQUE REFERENCES financeiro_faturamentos(id),
 titulo_id TEXT REFERENCES financeiro_titulos(id), direcao TEXT NOT NULL CHECK(direcao IN ('ENTRADA','SAIDA')),
 modelo TEXT NOT NULL CHECK(modelo IN ('NFE','NFSE','NFCE','OUTRO')),
 emissor TEXT NOT NULL CHECK(emissor IN ('SEFAZ','NFSE_NACIONAL','SEBRAE_LEGADO','EXTERNO')),
 ambiente TEXT NOT NULL DEFAULT 'PRODUCAO' CHECK(ambiente IN ('HOMOLOGACAO','PRODUCAO')),
 status TEXT NOT NULL CHECK(status IN ('RASCUNHO','PENDENTE','AUTORIZADO','REJEITADO','CANCELADO')),
 contraparte_nome TEXT NOT NULL, numero TEXT, serie TEXT, chave TEXT UNIQUE, protocolo TEXT,
 emissao TEXT NOT NULL, valor_centavos INTEGER NOT NULL CHECK(valor_centavos > 0),
 xml_conteudo TEXT, ultimo_erro TEXT, tentativas INTEGER NOT NULL DEFAULT 0,
 autorizado_em TEXT, cancelado_em TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_fin_documentos_fiscais_status ON financeiro_documentos_fiscais(status,emissao);

CREATE TABLE financeiro_integracoes_fiscais (
 id TEXT PRIMARY KEY, provedor TEXT NOT NULL UNIQUE,
 rotulo TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 0,
 ambiente TEXT NOT NULL DEFAULT 'HOMOLOGACAO' CHECK(ambiente IN ('HOMOLOGACAO','PRODUCAO')),
 endpoint TEXT, segredo_referencia TEXT, atualizado_em TEXT NOT NULL
);
INSERT INTO financeiro_integracoes_fiscais(id,provedor,rotulo,ativo,ambiente,atualizado_em) VALUES
 ('sefaz','SEFAZ','NF-e / SEFAZ',0,'HOMOLOGACAO',CURRENT_TIMESTAMP),
 ('nfse-nacional','NFSE_NACIONAL','NFS-e Padrão Nacional',0,'HOMOLOGACAO',CURRENT_TIMESTAMP),
 ('sebrae-legado','SEBRAE_LEGADO','Importação do emissor Sebrae legado',1,'PRODUCAO',CURRENT_TIMESTAMP);

-- Notas de entrada já capturadas em Compras passam a aparecer na central fiscal.
INSERT INTO financeiro_documentos_fiscais
 (id,titulo_id,direcao,modelo,emissor,ambiente,status,contraparte_nome,numero,chave,emissao,
  valor_centavos,criado_em,atualizado_em)
SELECT 'compras-'||r.id,
 (SELECT t.id FROM financeiro_titulos t WHERE t.origem_modulo='COMPRAS' AND t.origem_id=r.id LIMIT 1),
 'ENTRADA','NFE','EXTERNO','PRODUCAO','AUTORIZADO',p.fornecedor_nome,r.nota_fiscal,r.chave_nf,
 COALESCE(substr(r.data_emissao_nf,1,10),substr(r.recebido_em,1,10)),
 COALESCE(r.valor_nf_centavos,round(sum(ri.quantidade*ri.valor_unitario)*100)),r.recebido_em,r.recebido_em
FROM compras_recebimentos r
JOIN compras_pedidos p ON p.id=r.pedido_id
JOIN compras_recebimento_itens ri ON ri.recebimento_id=r.id
WHERE r.chave_nf IS NOT NULL AND trim(r.chave_nf)<>''
GROUP BY r.id
HAVING COALESCE(r.valor_nf_centavos,round(sum(ri.quantidade*ri.valor_unitario)*100)) > 0;
