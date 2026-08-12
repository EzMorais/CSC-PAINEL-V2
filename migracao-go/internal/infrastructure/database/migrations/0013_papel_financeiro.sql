-- Perfis dedicados do módulo Financeiro: separa quem opera a tesouraria (lança/baixa)
-- de quem aprova, sem depender do cargo global. Vazio/NENHUM = vale a regra global.
ALTER TABLE usuarios ADD COLUMN papel_financeiro TEXT NOT NULL DEFAULT 'NENHUM';
