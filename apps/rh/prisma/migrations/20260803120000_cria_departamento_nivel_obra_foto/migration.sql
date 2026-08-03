-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paiId" TEXT,
    CONSTRAINT "Departamento_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "Departamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nome_key" ON "Departamento"("nome");

-- CreateIndex
CREATE INDEX "Departamento_paiId_idx" ON "Departamento"("paiId");

-- AlterTable
ALTER TABLE "Funcionario" ADD COLUMN "foto" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "departamentoId" TEXT REFERENCES "Departamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Funcionario" ADD COLUMN "nivelObra" TEXT;

-- CreateIndex
CREATE INDEX "Funcionario_departamentoId_idx" ON "Funcionario"("departamentoId");
