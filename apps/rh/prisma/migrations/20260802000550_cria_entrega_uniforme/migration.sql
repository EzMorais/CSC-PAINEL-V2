-- CreateTable
CREATE TABLE "EntregaUniforme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "peca" TEXT NOT NULL,
    "tamanho" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "motivo" TEXT NOT NULL,
    "entregueEm" DATETIME NOT NULL,
    "observacao" TEXT,
    "assinatura" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "funcionarioId" TEXT NOT NULL,
    CONSTRAINT "EntregaUniforme_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EntregaUniforme_funcionarioId_entregueEm_idx" ON "EntregaUniforme"("funcionarioId", "entregueEm");
