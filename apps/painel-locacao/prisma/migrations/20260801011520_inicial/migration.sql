-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cliente" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "abaOrigem" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FornecedorAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alias" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    CONSTRAINT "FornecedorAlias_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Locacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descricao" TEXT NOT NULL,
    "trCodigo" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'OK',
    "observacoes" TEXT,
    "dataInicio" DATETIME,
    "dataFim" DATETIME,
    "valorItem" REAL,
    "devolvidaEm" DATETIME,
    "obraAConfirmar" BOOLEAN NOT NULL DEFAULT false,
    "numeroOrigem" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "obraId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    CONSTRAINT "Locacao_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Locacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "descricaoHumana" TEXT NOT NULL,
    "payloadAntes" TEXT,
    "payloadDepois" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locacaoId" TEXT NOT NULL,
    CONSTRAINT "Movimentacao_locacaoId_fkey" FOREIGN KEY ("locacaoId") REFERENCES "Locacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigo_key" ON "Obra"("codigo");

-- CreateIndex
CREATE INDEX "Obra_cliente_idx" ON "Obra"("cliente");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_nome_key" ON "Fornecedor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "FornecedorAlias_alias_key" ON "FornecedorAlias"("alias");

-- CreateIndex
CREATE INDEX "FornecedorAlias_fornecedorId_idx" ON "FornecedorAlias"("fornecedorId");

-- CreateIndex
CREATE INDEX "Locacao_obraId_idx" ON "Locacao"("obraId");

-- CreateIndex
CREATE INDEX "Locacao_fornecedorId_idx" ON "Locacao"("fornecedorId");

-- CreateIndex
CREATE INDEX "Locacao_dataFim_idx" ON "Locacao"("dataFim");

-- CreateIndex
CREATE INDEX "Locacao_devolvidaEm_idx" ON "Locacao"("devolvidaEm");

-- CreateIndex
CREATE INDEX "Movimentacao_locacaoId_idx" ON "Movimentacao"("locacaoId");
