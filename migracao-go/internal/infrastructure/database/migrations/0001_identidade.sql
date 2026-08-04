-- A única tabela de usuários do conjunto — ver migracao-go/portal/COMPORTAMENTO.md §4.
-- Timestamps são sempre gravados pela aplicação (RFC3339 UTC), nunca pelo DEFAULT do
-- SQLite: o formato de CURRENT_TIMESTAMP não bate com o que o Go espera ao ler de volta.
CREATE TABLE usuarios (
    id            TEXT PRIMARY KEY,
    nome          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    senha_hash    TEXT NOT NULL,
    cargo         TEXT NOT NULL DEFAULT 'OPERACIONAL',
    ativo         INTEGER NOT NULL DEFAULT 1,
    telefone      TEXT,
    observacao    TEXT,
    criado_em     TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    ultimo_acesso TEXT
);
CREATE INDEX idx_usuarios_cargo ON usuarios (cargo);

-- A quais módulos a pessoa entra — separado do cargo de propósito, ver COMPORTAMENTO.md §3.
CREATE TABLE acessos_modulo (
    id         TEXT PRIMARY KEY,
    modulo     TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    UNIQUE (usuario_id, modulo)
);
CREATE INDEX idx_acessos_modulo_modulo ON acessos_modulo (modulo);

-- Quem tentou entrar e quando — email em texto solto de propósito, não FK: precisa
-- sobreviver à exclusão do usuário. Ver COMPORTAMENTO.md §4.
CREATE TABLE registros_acesso (
    id       TEXT PRIMARY KEY,
    email    TEXT NOT NULL,
    nome     TEXT,
    sucesso  INTEGER NOT NULL,
    motivo   TEXT,
    ocorrido TEXT NOT NULL
);
CREATE INDEX idx_registros_acesso_ocorrido ON registros_acesso (ocorrido);
CREATE INDEX idx_registros_acesso_email ON registros_acesso (email);
