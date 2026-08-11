CREATE TABLE compras_pedidos (
    id               TEXT PRIMARY KEY,
    numero           TEXT NOT NULL UNIQUE,
    status           TEXT NOT NULL DEFAULT 'ABERTO',
    solicitacao_id   TEXT REFERENCES solicitacoes_compra (id) ON DELETE SET NULL,
    fornecedor_id    TEXT NOT NULL REFERENCES fornecedores (id),
    fornecedor_nome  TEXT NOT NULL,
    observacao       TEXT,
    criado_em        TEXT NOT NULL,
    recebido_em      TEXT,
    total_estimado   REAL NOT NULL DEFAULT 0,
    total_recebido   REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_compras_pedidos_status ON compras_pedidos (status, criado_em DESC);
CREATE INDEX idx_compras_pedidos_fornecedor ON compras_pedidos (fornecedor_id, criado_em DESC);

CREATE TABLE compras_pedido_itens (
    id                    TEXT PRIMARY KEY,
    pedido_id             TEXT NOT NULL REFERENCES compras_pedidos (id) ON DELETE CASCADE,
    material_id           TEXT NOT NULL REFERENCES materiais (id),
    material_codigo       TEXT NOT NULL,
    material_nome         TEXT NOT NULL,
    material_unidade      TEXT NOT NULL,
    quantidade_solicitada REAL NOT NULL,
    quantidade_recebida   REAL NOT NULL DEFAULT 0,
    preco_unitario        REAL,
    observacao            TEXT,
    UNIQUE (pedido_id, material_id)
);
CREATE INDEX idx_compras_pedido_itens_pedido ON compras_pedido_itens (pedido_id);

CREATE TABLE compras_recebimentos (
    id             TEXT PRIMARY KEY,
    pedido_id      TEXT NOT NULL REFERENCES compras_pedidos (id) ON DELETE CASCADE,
    numero         TEXT NOT NULL UNIQUE,
    recebido_em    TEXT NOT NULL,
    recebido_por   TEXT NOT NULL,
    nota_fiscal    TEXT,
    observacao     TEXT,
    conta_pagar_id TEXT REFERENCES contas_pagar (id) ON DELETE SET NULL
);
CREATE INDEX idx_compras_recebimentos_pedido ON compras_recebimentos (pedido_id, recebido_em DESC);

CREATE TABLE compras_recebimento_itens (
    id              TEXT PRIMARY KEY,
    recebimento_id  TEXT NOT NULL REFERENCES compras_recebimentos (id) ON DELETE CASCADE,
    pedido_item_id  TEXT NOT NULL REFERENCES compras_pedido_itens (id),
    material_id     TEXT NOT NULL REFERENCES materiais (id),
    quantidade      REAL NOT NULL,
    valor_unitario  REAL NOT NULL
);
CREATE INDEX idx_compras_recebimento_itens_recebimento ON compras_recebimento_itens (recebimento_id);

CREATE TABLE contas_pagar (
    id              TEXT PRIMARY KEY,
    numero          TEXT NOT NULL UNIQUE,
    pedido_id       TEXT REFERENCES compras_pedidos (id) ON DELETE SET NULL,
    recebimento_id   TEXT REFERENCES compras_recebimentos (id) ON DELETE SET NULL,
    fornecedor_id   TEXT NOT NULL REFERENCES fornecedores (id),
    fornecedor_nome TEXT NOT NULL,
    valor_total     REAL NOT NULL,
    valor_aberto    REAL NOT NULL,
    vencimento      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ABERTA',
    criado_em       TEXT NOT NULL,
    pago_em         TEXT,
    observacao      TEXT
);
CREATE INDEX idx_contas_pagar_status ON contas_pagar (status, vencimento ASC);
CREATE INDEX idx_contas_pagar_fornecedor ON contas_pagar (fornecedor_id, vencimento ASC);

CREATE TABLE contas_pagar_parcelas (
    id             TEXT PRIMARY KEY,
    conta_pagar_id TEXT NOT NULL REFERENCES contas_pagar (id) ON DELETE CASCADE,
    numero         INTEGER NOT NULL,
    valor          REAL NOT NULL,
    vencimento     TEXT NOT NULL,
    pago_em        TEXT,
    status         TEXT NOT NULL DEFAULT 'ABERTA',
    observacao     TEXT,
    UNIQUE (conta_pagar_id, numero)
);
CREATE INDEX idx_contas_pagar_parcelas_conta ON contas_pagar_parcelas (conta_pagar_id, numero);
