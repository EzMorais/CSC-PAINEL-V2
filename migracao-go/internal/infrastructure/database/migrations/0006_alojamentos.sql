-- Alojamentos usa as obras compartilhadas. Endereço/coordenadas pertencem ao cadastro
-- comum agora que todos os módulos vivem no mesmo banco.
ALTER TABLE obras ADD COLUMN endereco TEXT;
ALTER TABLE obras ADD COLUMN cidade TEXT;
ALTER TABLE obras ADD COLUMN uf TEXT;
ALTER TABLE obras ADD COLUMN lat REAL;
ALTER TABLE obras ADD COLUMN lng REAL;

CREATE TABLE alojamentos (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, cep TEXT, logradouro TEXT, numero TEXT,
 complemento TEXT, bairro TEXT, cidade TEXT, uf TEXT, lat REAL, lng REAL,
 capacidade_total INTEGER, responsavel_nome TEXT, telefone_responsavel TEXT,
 grupo_whatsapp_id TEXT UNIQUE, foto TEXT, observacoes TEXT, ativo INTEGER NOT NULL DEFAULT 1,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_alojamentos_ativo ON alojamentos(ativo);

CREATE TABLE quartos (
 id TEXT PRIMARY KEY, alojamento_id TEXT NOT NULL REFERENCES alojamentos(id) ON DELETE CASCADE,
 numero TEXT NOT NULL, capacidade INTEGER NOT NULL DEFAULT 1, tipo TEXT, observacoes TEXT,
 ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL,
 UNIQUE(alojamento_id, numero)
);

CREATE TABLE rotas_onibus (
 id TEXT PRIMARY KEY, nome TEXT NOT NULL, motorista TEXT, veiculo TEXT, horario_ida TEXT,
 horario_volta TEXT, capacidade INTEGER, obra_codigo TEXT, observacao TEXT,
 ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);

CREATE TABLE alocacoes (
 id TEXT PRIMARY KEY, funcionario_id TEXT NOT NULL REFERENCES funcionarios(id),
 funcionario_nome TEXT NOT NULL, funcionario_matricula TEXT NOT NULL, obra_codigo TEXT,
 alojamento_id TEXT NOT NULL REFERENCES alojamentos(id), quarto_id TEXT REFERENCES quartos(id),
 obra_id TEXT REFERENCES obras(id), data_entrada TEXT NOT NULL, data_saida TEXT,
 status TEXT NOT NULL DEFAULT 'ATIVA', motivo_saida TEXT,
 transporte_tipo TEXT NOT NULL DEFAULT 'PROPRIO', carona_com_nome TEXT,
 rota_onibus_id TEXT REFERENCES rotas_onibus(id), telefone TEXT, observacoes TEXT,
 registrado_por TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_alocacao_funcionario_ativa ON alocacoes(funcionario_id) WHERE status='ATIVA';
CREATE INDEX idx_alocacoes_alojamento ON alocacoes(alojamento_id);

CREATE TABLE pedidos_alojamento (
 id TEXT PRIMARY KEY, tipo TEXT NOT NULL, titulo TEXT NOT NULL, descricao TEXT,
 status TEXT NOT NULL DEFAULT 'ABERTO', prioridade TEXT NOT NULL DEFAULT 'NORMAL',
 alocacao_id TEXT REFERENCES alocacoes(id), funcionario_nome TEXT, atendido_por TEXT,
 atendido_em TEXT, resposta_observacao TEXT, origem TEXT NOT NULL DEFAULT 'SISTEMA',
 telefone_origem TEXT, grupo_origem_id TEXT, nome_origem TEXT, registrado_por TEXT,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
 alojamento_id TEXT NOT NULL REFERENCES alojamentos(id)
);
CREATE INDEX idx_pedidos_alojamento_status ON pedidos_alojamento(status);

CREATE TABLE programacoes_alojamento (
 id TEXT PRIMARY KEY, data TEXT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL,
 descricao TEXT, horario TEXT, responsavel_nome TEXT, criado_por TEXT,
 criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
 alojamento_id TEXT REFERENCES alojamentos(id)
);
CREATE INDEX idx_programacoes_alojamento_data ON programacoes_alojamento(data);

CREATE TABLE conversas_whatsapp_alojamento (
 id TEXT PRIMARY KEY, telefone TEXT NOT NULL UNIQUE, passo TEXT NOT NULL,
 tipo_escolhido TEXT, descricao TEXT, alocacao_id TEXT REFERENCES alocacoes(id) ON DELETE SET NULL,
 expira_em TEXT NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
);
CREATE TABLE mensagens_whatsapp_alojamento (
 id TEXT PRIMARY KEY, telefone TEXT NOT NULL, grupo_id TEXT, direcao TEXT NOT NULL,
 texto TEXT NOT NULL, externo_id TEXT, pedido_id TEXT, erro TEXT, criado_em TEXT NOT NULL,
 UNIQUE(externo_id, direcao)
);
