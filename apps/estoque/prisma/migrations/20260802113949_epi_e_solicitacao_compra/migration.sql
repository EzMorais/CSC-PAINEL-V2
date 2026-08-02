-- AlterTable
ALTER TABLE "Material" ADD COLUMN "ca" TEXT;
ALTER TABLE "Material" ADD COLUMN "validadeCA" DATETIME;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN "erroSincronizacao" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "funcionarioId" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "funcionarioNome" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "sincronizadoEm" DATETIME;

-- CreateTable
CREATE TABLE "SolicitacaoCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" DATETIME,
    "atendidaEm" DATETIME,
    "registradoPor" TEXT
);

-- CreateTable
CREATE TABLE "ItemSolicitacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantidade" REAL NOT NULL,
    "saldoNaEpoca" REAL NOT NULL,
    "minimoNaEpoca" REAL NOT NULL,
    "precoEstimado" REAL,
    "observacao" TEXT,
    "solicitacaoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    CONSTRAINT "ItemSolicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCompra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemSolicitacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoCompra_numero_key" ON "SolicitacaoCompra"("numero");

-- CreateIndex
CREATE INDEX "SolicitacaoCompra_status_idx" ON "SolicitacaoCompra"("status");

-- CreateIndex
CREATE INDEX "ItemSolicitacao_materialId_idx" ON "ItemSolicitacao"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemSolicitacao_solicitacaoId_materialId_key" ON "ItemSolicitacao"("solicitacaoId", "materialId");

-- CreateIndex
CREATE INDEX "Movimentacao_funcionarioId_idx" ON "Movimentacao"("funcionarioId");
