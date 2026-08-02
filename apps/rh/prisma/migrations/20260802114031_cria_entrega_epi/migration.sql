-- CreateTable
CREATE TABLE "EntregaEpi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movimentacaoId" TEXT NOT NULL,
    "materialCodigo" TEXT NOT NULL,
    "materialNome" TEXT NOT NULL,
    "ca" TEXT,
    "validadeCA" DATETIME,
    "quantidade" REAL NOT NULL,
    "unidade" TEXT NOT NULL,
    "entregueEm" DATETIME NOT NULL,
    "observacao" TEXT,
    "entreguePor" TEXT,
    "recebidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "funcionarioId" TEXT NOT NULL,
    CONSTRAINT "EntregaEpi_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EntregaEpi_movimentacaoId_key" ON "EntregaEpi"("movimentacaoId");

-- CreateIndex
CREATE INDEX "EntregaEpi_funcionarioId_entregueEm_idx" ON "EntregaEpi"("funcionarioId", "entregueEm");

-- CreateIndex
CREATE INDEX "EntregaEpi_entregueEm_idx" ON "EntregaEpi"("entregueEm");
