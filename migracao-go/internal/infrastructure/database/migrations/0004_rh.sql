-- RH e SST — ver migracao-go/rh/COMPORTAMENTO.md. Referencia `obras` (criada em
-- 0002_painel.sql) por FK direta: decisão de banco único já tomada para o Almoxarifado
-- (0003_estoque.sql) vale aqui também — nada de tabela `rh_obras` separada.
--
-- Todas as tabelas de anexo (foto, assinatura, certificado, arquivo) guardam `data:` URI em
-- coluna TEXT — mesma decisão do Next.js (COMPORTAMENTO.md §2): nenhum storage de arquivo
-- separado.

CREATE TABLE cargos (
    id        TEXT PRIMARY KEY,
    nome      TEXT NOT NULL UNIQUE,
    cbo       TEXT,
    risco     TEXT NOT NULL DEFAULT 'NORMAL',
    ativo     INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

-- Dois níveis (ramo sem pai_id, setor com pai_id apontando pra um ramo) — validado na
-- camada de aplicação, não aqui, mesma decisão do Next.js (COMPORTAMENTO.md §2).
CREATE TABLE departamentos (
    id      TEXT PRIMARY KEY,
    nome    TEXT NOT NULL UNIQUE,
    pai_id  TEXT REFERENCES departamentos (id)
);

CREATE TABLE funcionarios (
    id               TEXT PRIMARY KEY,
    matricula        TEXT NOT NULL UNIQUE,
    nome             TEXT NOT NULL,
    cpf              TEXT NOT NULL UNIQUE,
    rg               TEXT,
    data_nascimento  TEXT,
    sexo             TEXT,
    estado_civil     TEXT,
    nome_mae         TEXT,
    foto             TEXT,
    telefone         TEXT,
    email            TEXT,
    cep              TEXT,
    logradouro       TEXT,
    numero           TEXT,
    complemento      TEXT,
    bairro           TEXT,
    cidade           TEXT,
    uf               TEXT,
    status           TEXT NOT NULL DEFAULT 'ATIVO',
    admitido_em      TEXT NOT NULL,
    demitido_em      TEXT,
    motivo_saida     TEXT,
    salario          REAL,
    tipo_contrato    TEXT NOT NULL DEFAULT 'CLT',
    banco            TEXT,
    agencia          TEXT,
    conta            TEXT,
    tipo_conta       TEXT,
    chave_pix        TEXT,
    tamanho_camisa   TEXT,
    tamanho_calca    TEXT,
    tamanho_calcado  TEXT,
    observacoes      TEXT,
    nivel_obra       TEXT,
    criado_em        TEXT NOT NULL,
    obra_id          TEXT REFERENCES obras (id),
    cargo_id         TEXT REFERENCES cargos (id),
    departamento_id  TEXT REFERENCES departamentos (id)
);
CREATE INDEX idx_funcionarios_obra ON funcionarios (obra_id);
CREATE INDEX idx_funcionarios_cargo ON funcionarios (cargo_id);
CREATE INDEX idx_funcionarios_departamento ON funcionarios (departamento_id);
CREATE INDEX idx_funcionarios_status ON funcionarios (status);
CREATE INDEX idx_funcionarios_nome ON funcionarios (nome);

CREATE TABLE dependentes (
    id               TEXT PRIMARY KEY,
    nome             TEXT NOT NULL,
    parentesco       TEXT NOT NULL,
    data_nascimento  TEXT,
    cpf              TEXT,
    irrf             INTEGER NOT NULL DEFAULT 0,
    salario_familia  INTEGER NOT NULL DEFAULT 0,
    funcionario_id   TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE
);
CREATE INDEX idx_dependentes_funcionario ON dependentes (funcionario_id);

-- Timeline append-única do funcionário — "fonte da verdade" do histórico (COMPORTAMENTO.md
-- §3). ocorrido_em é quando aconteceu de fato; registrado_em é quando foi digitado.
CREATE TABLE eventos (
    id                TEXT PRIMARY KEY,
    tipo              TEXT NOT NULL,
    descricao_humana  TEXT NOT NULL,
    detalhe           TEXT,
    ocorrido_em       TEXT NOT NULL,
    registrado_em     TEXT NOT NULL,
    registrado_por    TEXT,
    funcionario_id    TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE,
    obra_id           TEXT REFERENCES obras (id)
);
CREATE INDEX idx_eventos_funcionario ON eventos (funcionario_id, ocorrido_em);
CREATE INDEX idx_eventos_obra ON eventos (obra_id);
CREATE INDEX idx_eventos_tipo ON eventos (tipo);

CREATE TABLE entregas_uniforme (
    id             TEXT PRIMARY KEY,
    peca           TEXT NOT NULL,
    tamanho        TEXT NOT NULL,
    quantidade     INTEGER NOT NULL DEFAULT 1,
    motivo         TEXT NOT NULL,
    entregue_em    TEXT NOT NULL,
    observacao     TEXT,
    assinatura     TEXT,
    registrado_por TEXT,
    funcionario_id TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE
);
CREATE INDEX idx_entregas_uniforme_funcionario ON entregas_uniforme (funcionario_id, entregue_em);

CREATE TABLE treinamentos (
    id             TEXT PRIMARY KEY,
    norma          TEXT NOT NULL,
    descricao      TEXT NOT NULL,
    instrutor      TEXT,
    carga_horaria  REAL,
    realizado_em   TEXT NOT NULL,
    validade_em    TEXT
);
CREATE INDEX idx_treinamentos_validade ON treinamentos (validade_em);
CREATE INDEX idx_treinamentos_norma ON treinamentos (norma);

CREATE TABLE treinamento_participantes (
    id              TEXT PRIMARY KEY,
    certificado     TEXT,
    treinamento_id  TEXT NOT NULL REFERENCES treinamentos (id) ON DELETE CASCADE,
    funcionario_id  TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE,
    UNIQUE (treinamento_id, funcionario_id)
);
CREATE INDEX idx_treinamento_participantes_funcionario ON treinamento_participantes (funcionario_id);

-- Nunca criada pela UI do RH — só pelo endpoint de integração vindo do Almoxarifado. Ver
-- COMPORTAMENTO.md §6. movimentacao_id é a chave de idempotência (id da movimentação no
-- Almoxarifado — bancos hoje não têm FK real entre módulos nesse sentido específico, porque
-- a movimentação de estoque pode ter sido lançada antes do RH confirmar o recebimento).
CREATE TABLE entregas_epi (
    id              TEXT PRIMARY KEY,
    movimentacao_id TEXT NOT NULL UNIQUE,
    material_codigo TEXT NOT NULL,
    material_nome   TEXT NOT NULL,
    ca              TEXT,
    validade_ca     TEXT,
    quantidade      REAL NOT NULL,
    unidade         TEXT NOT NULL,
    entregue_em     TEXT NOT NULL,
    observacao      TEXT,
    entregue_por    TEXT,
    recebido_em     TEXT NOT NULL,
    funcionario_id  TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE
);
CREATE INDEX idx_entregas_epi_funcionario ON entregas_epi (funcionario_id, entregue_em);
CREATE INDEX idx_entregas_epi_entregue_em ON entregas_epi (entregue_em);

CREATE TABLE exames (
    id             TEXT PRIMARY KEY,
    tipo           TEXT NOT NULL,
    realizado_em   TEXT NOT NULL,
    validade_em    TEXT,
    resultado      TEXT NOT NULL,
    restricoes     TEXT,
    arquivo        TEXT,
    registrado_por TEXT,
    funcionario_id TEXT NOT NULL REFERENCES funcionarios (id) ON DELETE CASCADE
);
CREATE INDEX idx_exames_funcionario ON exames (funcionario_id, realizado_em);
CREATE INDEX idx_exames_validade ON exames (validade_em);

-- Cobre dois casos com a mesma tabela (COMPORTAMENTO.md §2): regulatório de empresa/obra
-- (funcionario_id NULL) OU pessoal de admissão (funcionario_id preenchido) — exatamente um
-- dos dois vínculos preenchido, nunca os dois nem nenhum (regra de aplicação, não de CHECK,
-- mesma decisão do Next.js).
CREATE TABLE documentos (
    id             TEXT PRIMARY KEY,
    categoria      TEXT NOT NULL,
    titulo         TEXT NOT NULL,
    versao         INTEGER NOT NULL DEFAULT 1,
    vigente_desde  TEXT,
    valido_ate     TEXT,
    arquivo        TEXT,
    observacao     TEXT,
    registrado_por TEXT,
    criado_em      TEXT NOT NULL,
    obra_id        TEXT REFERENCES obras (id),
    funcionario_id TEXT REFERENCES funcionarios (id) ON DELETE CASCADE
);
CREATE INDEX idx_documentos_categoria ON documentos (categoria);
CREATE INDEX idx_documentos_obra ON documentos (obra_id);
CREATE INDEX idx_documentos_funcionario ON documentos (funcionario_id);
CREATE INDEX idx_documentos_valido_ate ON documentos (valido_ate);

CREATE TABLE auditorias (
    id             TEXT PRIMARY KEY,
    titulo         TEXT NOT NULL,
    norma          TEXT,
    realizada_em   TEXT NOT NULL,
    responsavel    TEXT,
    registrado_por TEXT,
    obra_id        TEXT REFERENCES obras (id)
);
CREATE INDEX idx_auditorias_obra ON auditorias (obra_id);

CREATE TABLE auditoria_itens (
    id            TEXT PRIMARY KEY,
    descricao     TEXT NOT NULL,
    situacao      TEXT NOT NULL,
    evidencia     TEXT,
    auditoria_id  TEXT NOT NULL REFERENCES auditorias (id) ON DELETE CASCADE
);
CREATE INDEX idx_auditoria_itens_auditoria ON auditoria_itens (auditoria_id);

-- Pode nascer solta (auditoria_item_id NULL) ou a partir de um item reprovado — no máximo
-- uma NC por item (UNIQUE), sentido NC→Item (COMPORTAMENTO.md §2).
CREATE TABLE nao_conformidades (
    id                 TEXT PRIMARY KEY,
    titulo             TEXT NOT NULL,
    descricao          TEXT NOT NULL,
    gravidade          TEXT NOT NULL,
    responsavel        TEXT,
    prazo              TEXT,
    status             TEXT NOT NULL DEFAULT 'ABERTA',
    evidencia_antes    TEXT,
    evidencia_depois   TEXT,
    registrado_por     TEXT,
    resolvido_em       TEXT,
    criado_em          TEXT NOT NULL,
    auditoria_item_id  TEXT UNIQUE REFERENCES auditoria_itens (id)
);
CREATE INDEX idx_nao_conformidades_status ON nao_conformidades (status);
