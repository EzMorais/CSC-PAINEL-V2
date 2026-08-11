-- P0: fechamento é uma trava de competência, não apenas um indicador na tela.
-- Correções retroativas entram por estorno no período aberto e deixam o vínculo
-- com o fato original no livro append-only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_movimento_estorno_unico
 ON financeiro_movimentos(movimento_original_id) WHERE tipo='ESTORNO';
CREATE INDEX IF NOT EXISTS idx_fin_movimentos_original ON financeiro_movimentos(movimento_original_id);

CREATE TRIGGER financeiro_titulo_competencia_fechada_insert
BEFORE INSERT ON financeiro_titulos
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=NEW.competencia AND status='FECHADO')
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_titulo_competencia_fechada_update
BEFORE UPDATE ON financeiro_titulos
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=OLD.competencia AND status='FECHADO')
 AND NOT (NEW.valor_aberto_centavos > OLD.valor_aberto_centavos AND NEW.status IN ('APROVADO','PARCIAL'))
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_parcela_competencia_fechada_insert
BEFORE INSERT ON financeiro_parcelas
WHEN EXISTS (
 SELECT 1 FROM financeiro_fechamentos f
 JOIN financeiro_titulos t ON t.id=NEW.titulo_id
 WHERE f.competencia=substr(NEW.vencimento,1,7) AND f.status='FECHADO'
)
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_movimento_competencia_fechada_insert
BEFORE INSERT ON financeiro_movimentos
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=substr(NEW.ocorrido_em,1,7) AND status='FECHADO')
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_faturamento_competencia_fechada_insert
BEFORE INSERT ON financeiro_faturamentos
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=substr(NEW.emissao,1,7) AND status='FECHADO')
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_faturamento_competencia_fechada_update
BEFORE UPDATE ON financeiro_faturamentos
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=substr(OLD.emissao,1,7) AND status='FECHADO')
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;

CREATE TRIGGER financeiro_documento_competencia_fechada_update
BEFORE UPDATE ON financeiro_documentos_fiscais
WHEN EXISTS (SELECT 1 FROM financeiro_fechamentos WHERE competencia=substr(OLD.emissao,1,7) AND status='FECHADO')
BEGIN SELECT RAISE(ABORT,'competência financeira fechada'); END;
