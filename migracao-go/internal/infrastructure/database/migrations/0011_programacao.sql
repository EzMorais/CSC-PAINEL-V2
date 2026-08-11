-- Programação Diária em Go — porta do apps/programacao (Next.js) descrito em
-- https://github.com/EzMorais/CSC-PAINEL. Ver internal/domain/programacao/programacao.go
-- para o porquê de cada campo (comentários carregados do schema.prisma original).

CREATE TABLE programacao_frentes (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL UNIQUE, cor TEXT NOT NULL DEFAULT '#DDEBF7',
 logo TEXT, ordem INTEGER NOT NULL DEFAULT 0, colunas INTEGER NOT NULL DEFAULT 1,
 obra_codigo TEXT, ativa INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
);
CREATE INDEX idx_prog_frentes_ordem ON programacao_frentes(ordem);

CREATE TABLE programacao_funcoes (
 id TEXT PRIMARY KEY, sigla TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, cargo_rh TEXT,
 ordem INTEGER NOT NULL DEFAULT 0, ativa INTEGER NOT NULL DEFAULT 1,
 cor TEXT NOT NULL DEFAULT '#8B0000'
);
CREATE INDEX idx_prog_funcoes_ordem ON programacao_funcoes(ordem);

-- Cadastro fixo complementar ao RH: a Programação move muito mais gente do que o RH tem
-- cadastrada (prestadores, diaristas). Ver domain/programacao/programacao.go.
CREATE TABLE programacao_funcionarios (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, funcao_sigla TEXT, foto TEXT,
 ativo INTEGER NOT NULL DEFAULT 1, ausente INTEGER NOT NULL DEFAULT 0, ausente_obs TEXT,
 motorista INTEGER NOT NULL DEFAULT 0, tipo TEXT NOT NULL DEFAULT 'CSC',
 criado_em TEXT NOT NULL
);
CREATE INDEX idx_prog_funcionarios_ativo ON programacao_funcionarios(ativo);

CREATE TABLE programacao_veiculos (
 id TEXT PRIMARY KEY, modelo TEXT NOT NULL, placa TEXT, motorista_nome TEXT, foto TEXT,
 ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
);

CREATE TABLE programacoes (
 id TEXT PRIMARY KEY, data TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'RASCUNHO',
 publicada_em TEXT, publicada_por TEXT, observacao TEXT,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_programacoes_data ON programacoes(data);

CREATE TABLE programacao_escalas (
 id TEXT PRIMARY KEY, programacao_id TEXT NOT NULL REFERENCES programacoes(id) ON DELETE CASCADE,
 frente_id TEXT NOT NULL REFERENCES programacao_frentes(id) ON DELETE CASCADE,
 funcionario_id TEXT, funcionario_local_id TEXT REFERENCES programacao_funcionarios(id),
 nome TEXT NOT NULL, funcao_sigla TEXT, ordem INTEGER NOT NULL DEFAULT 0, observacao TEXT,
 UNIQUE(programacao_id, frente_id, nome)
);
CREATE INDEX idx_prog_escalas_programacao ON programacao_escalas(programacao_id);
CREATE INDEX idx_prog_escalas_frente ON programacao_escalas(frente_id);

CREATE TABLE programacao_recursos (
 id TEXT PRIMARY KEY, programacao_id TEXT NOT NULL REFERENCES programacoes(id) ON DELETE CASCADE,
 frente_id TEXT NOT NULL REFERENCES programacao_frentes(id) ON DELETE CASCADE,
 tipo TEXT NOT NULL DEFAULT 'VEICULO', placa TEXT, descricao TEXT NOT NULL,
 motorista_nome TEXT, destaque INTEGER NOT NULL DEFAULT 0,
 veiculo_local_id TEXT REFERENCES programacao_veiculos(id), ordem INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_prog_recursos_programacao ON programacao_recursos(programacao_id);
CREATE INDEX idx_prog_recursos_frente ON programacao_recursos(frente_id);
CREATE INDEX idx_prog_recursos_placa ON programacao_recursos(placa);
