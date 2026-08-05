-- cnpj/email só existem no cadastro de fornecedor do Almoxarifado no Next.js — coluna
-- aditiva na tabela compartilhada `fornecedores` (ver 0002_painel.sql). O Painel não as
-- preenche, ficam NULL para os fornecedores criados por ele.
ALTER TABLE fornecedores ADD COLUMN cnpj TEXT;
ALTER TABLE fornecedores ADD COLUMN email TEXT;

-- Cadastro do material. Sem coluna de saldo de propósito — ver estoque/COMPORTAMENTO.md §3:
-- o saldo é sempre somado a partir de movimentacoes_estoque, nunca armazenado.
CREATE TABLE materiais (
    id             TEXT PRIMARY KEY,
    codigo         TEXT NOT NULL UNIQUE,
    nome           TEXT NOT NULL,
    categoria      TEXT NOT NULL,
    unidade        TEXT NOT NULL,
    estoque_minimo REAL NOT NULL DEFAULT 0,
    localizacao    TEXT,
    observacao     TEXT,
    ativo          INTEGER NOT NULL DEFAULT 1,
    -- CA e validade só fazem sentido em categoria EPI — ver exigeFuncionario/paraBanco.
    ca             TEXT,
    validade_ca    TEXT,
    criado_em      TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL
);
CREATE INDEX idx_materiais_categoria ON materiais (categoria);
CREATE INDEX idx_materiais_nome ON materiais (nome);

-- Livro-razão append-only do almoxarifado. Nome "movimentacoes_estoque", não
-- "movimentacoes": evita colisão com o conceito homônimo (porém diferente) do Painel.
CREATE TABLE movimentacoes_estoque (
    id                  TEXT PRIMARY KEY,
    tipo                TEXT NOT NULL,
    quantidade          REAL NOT NULL,
    valor_unitario      REAL,
    documento           TEXT,
    observacao          TEXT,
    ocorrido_em         TEXT NOT NULL,
    registrado_em       TEXT NOT NULL,
    registrado_por      TEXT,
    -- Sem FK: funcionarioId é um id do banco do RH, hoje um processo/banco separado.
    funcionario_id      TEXT,
    funcionario_nome    TEXT,
    sincronizado_em     TEXT,
    erro_sincronizacao  TEXT,
    material_id         TEXT NOT NULL REFERENCES materiais (id) ON DELETE CASCADE,
    obra_id             TEXT REFERENCES obras (id),
    fornecedor_id       TEXT REFERENCES fornecedores (id)
);
CREATE INDEX idx_movimentacoes_estoque_material ON movimentacoes_estoque (material_id, ocorrido_em);
CREATE INDEX idx_movimentacoes_estoque_obra ON movimentacoes_estoque (obra_id);
CREATE INDEX idx_movimentacoes_estoque_tipo ON movimentacoes_estoque (tipo);
CREATE INDEX idx_movimentacoes_estoque_ocorrido ON movimentacoes_estoque (ocorrido_em);
CREATE INDEX idx_movimentacoes_estoque_funcionario ON movimentacoes_estoque (funcionario_id);

CREATE TABLE solicitacoes_compra (
    id                 TEXT PRIMARY KEY,
    numero             TEXT NOT NULL UNIQUE,
    status             TEXT NOT NULL DEFAULT 'RASCUNHO',
    observacao         TEXT,
    criado_em          TEXT NOT NULL,
    enviada_em         TEXT,
    atendida_em        TEXT,
    registrado_por     TEXT,
    email_enviado_para TEXT,
    email_enviado_em   TEXT,
    email_erro         TEXT
);
CREATE INDEX idx_solicitacoes_compra_status ON solicitacoes_compra (status);

CREATE TABLE itens_solicitacao (
    id               TEXT PRIMARY KEY,
    quantidade       REAL NOT NULL,
    saldo_na_epoca   REAL NOT NULL,
    minimo_na_epoca  REAL NOT NULL,
    preco_estimado   REAL,
    observacao       TEXT,
    solicitacao_id   TEXT NOT NULL REFERENCES solicitacoes_compra (id) ON DELETE CASCADE,
    material_id      TEXT NOT NULL REFERENCES materiais (id) ON DELETE CASCADE,
    UNIQUE (solicitacao_id, material_id)
);
CREATE INDEX idx_itens_solicitacao_material ON itens_solicitacao (material_id);

-- Fila de aprovação — propose-then-execute, ver COMPORTAMENTO.md §4. Nome
-- "aprovacoes_estoque": específico do módulo, não compartilhado.
CREATE TABLE aprovacoes_estoque (
    id               TEXT PRIMARY KEY,
    tipo             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'PENDENTE',
    dados            TEXT NOT NULL,
    motivo           TEXT,
    resumo           TEXT NOT NULL,
    solicitante_id   TEXT NOT NULL,
    solicitante_nome TEXT NOT NULL,
    aprovador_id     TEXT,
    aprovador_nome   TEXT,
    motivo_rejeicao  TEXT,
    referencia_id    TEXT,
    criado_em        TEXT NOT NULL,
    decidido_em      TEXT
);
CREATE INDEX idx_aprovacoes_estoque_status ON aprovacoes_estoque (status, criado_em);
CREATE INDEX idx_aprovacoes_estoque_tipo ON aprovacoes_estoque (tipo);

-- Linha única (id fixo 'unica') — conta SMTP + limiares de aprovação, mesmo padrão do
-- Next.js. Mora no banco, não no .env: quem configura é o almoxarife pela tela.
CREATE TABLE configuracao_email_estoque (
    id                       TEXT PRIMARY KEY DEFAULT 'unica',
    provedor                 TEXT NOT NULL DEFAULT 'GMAIL',
    host                     TEXT NOT NULL,
    porta                    INTEGER NOT NULL DEFAULT 587,
    usuario                  TEXT NOT NULL,
    senha                    TEXT NOT NULL,
    remetente                TEXT,
    destinatario_padrao      TEXT,
    copia_para               TEXT,
    enviar_automatico        INTEGER NOT NULL DEFAULT 1,
    limite_aprovacao_compra  REAL NOT NULL DEFAULT 1000,
    limite_ajuste_inventario REAL NOT NULL DEFAULT 10,
    ativo                    INTEGER NOT NULL DEFAULT 1,
    testado_em               TEXT,
    atualizado_em            TEXT NOT NULL
);
