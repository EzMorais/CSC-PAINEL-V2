-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Locacao" (
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
    "possivelDuplicata" BOOLEAN NOT NULL DEFAULT false,
    "numeroOrigem" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "obraId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    CONSTRAINT "Locacao_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Locacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Locacao" ("atualizadoEm", "criadoEm", "dataFim", "dataInicio", "descricao", "devolvidaEm", "estado", "fornecedorId", "id", "numeroOrigem", "obraAConfirmar", "obraId", "observacoes", "quantidade", "trCodigo", "valorItem") SELECT "atualizadoEm", "criadoEm", "dataFim", "dataInicio", "descricao", "devolvidaEm", "estado", "fornecedorId", "id", "numeroOrigem", "obraAConfirmar", "obraId", "observacoes", "quantidade", "trCodigo", "valorItem" FROM "Locacao";
DROP TABLE "Locacao";
ALTER TABLE "new_Locacao" RENAME TO "Locacao";
CREATE INDEX "Locacao_obraId_idx" ON "Locacao"("obraId");
CREATE INDEX "Locacao_fornecedorId_idx" ON "Locacao"("fornecedorId");
CREATE INDEX "Locacao_dataFim_idx" ON "Locacao"("dataFim");
CREATE INDEX "Locacao_devolvidaEm_idx" ON "Locacao"("devolvidaEm");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
