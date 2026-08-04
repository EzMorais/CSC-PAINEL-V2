-- obras e fornecedores são tabelas COMPARTILHÁVEIS entre módulos — decisão de banco único
-- em migracao-go/README.md ("Banco único"). Só o Painel as usa por enquanto; quando RH,
-- Almoxarifado e Alojamentos migrarem, referenciam estas mesmas tabelas em vez de criar
-- cópias. aba_origem é específico do Painel (mapeamento de aba de planilha) e fica
-- nullable — os demais módulos simplesmente não o preenchem.
CREATE TABLE obras (
    id          TEXT PRIMARY KEY,
    cliente     TEXT NOT NULL,
    codigo      TEXT NOT NULL UNIQUE,
    descricao   TEXT NOT NULL,
    responsavel TEXT,
    aba_origem  TEXT,
    ativa       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL
);
CREATE INDEX idx_obras_cliente ON obras (cliente);

CREATE TABLE fornecedores (
    id        TEXT PRIMARY KEY,
    nome      TEXT NOT NULL UNIQUE,
    telefone  TEXT,
    ativo     INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

-- alias é único GLOBALMENTE, não por fornecedor — ver COMPORTAMENTO.md §2/§4.2: é essa
-- constraint que impede reatribuir silenciosamente um apelido já usado por outro fornecedor.
CREATE TABLE fornecedor_aliases (
    id            TEXT PRIMARY KEY,
    alias         TEXT NOT NULL UNIQUE,
    fornecedor_id TEXT NOT NULL REFERENCES fornecedores (id) ON DELETE CASCADE
);
CREATE INDEX idx_fornecedor_aliases_fornecedor ON fornecedor_aliases (fornecedor_id);

CREATE TABLE locacoes (
    id                  TEXT PRIMARY KEY,
    descricao           TEXT NOT NULL,
    tr_codigo           TEXT,
    quantidade          INTEGER NOT NULL DEFAULT 1,
    estado              TEXT NOT NULL DEFAULT 'OK',
    observacoes         TEXT,
    data_inicio         TEXT,
    data_fim            TEXT,
    valor_item          REAL,
    devolvida_em        TEXT,
    obra_a_confirmar    INTEGER NOT NULL DEFAULT 0,
    possivel_duplicata  INTEGER NOT NULL DEFAULT 0,
    numero_origem       TEXT,
    criado_em           TEXT NOT NULL,
    atualizado_em       TEXT NOT NULL,
    obra_id             TEXT NOT NULL REFERENCES obras (id),
    fornecedor_id       TEXT REFERENCES fornecedores (id)
);
CREATE INDEX idx_locacoes_obra ON locacoes (obra_id);
CREATE INDEX idx_locacoes_fornecedor ON locacoes (fornecedor_id);
CREATE INDEX idx_locacoes_data_fim ON locacoes (data_fim);
CREATE INDEX idx_locacoes_devolvida_em ON locacoes (devolvida_em);

-- Nome "movimentacoes_locacao", não "movimentacoes": o Almoxarifado terá sua própria
-- tabela de movimentação de estoque, conceito diferente apesar do nome parecido em Next.js.
CREATE TABLE movimentacoes_locacao (
    id               TEXT PRIMARY KEY,
    tipo             TEXT NOT NULL,
    descricao_humana TEXT NOT NULL,
    payload_antes    TEXT,
    payload_depois   TEXT,
    criado_em        TEXT NOT NULL,
    locacao_id       TEXT NOT NULL REFERENCES locacoes (id) ON DELETE CASCADE
);
CREATE INDEX idx_movimentacoes_locacao_locacao ON movimentacoes_locacao (locacao_id);
