-- CreateTable
CREATE TABLE "Treinamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "norma" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "instrutor" TEXT,
    "cargaHoraria" INTEGER,
    "realizadoEm" DATETIME NOT NULL,
    "validadeEm" DATETIME,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TreinamentoParticipante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificado" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treinamentoId" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    CONSTRAINT "TreinamentoParticipante_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreinamentoParticipante_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Treinamento_validadeEm_idx" ON "Treinamento"("validadeEm");

-- CreateIndex
CREATE INDEX "Treinamento_norma_idx" ON "Treinamento"("norma");

-- CreateIndex
CREATE INDEX "TreinamentoParticipante_funcionarioId_idx" ON "TreinamentoParticipante"("funcionarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinamentoParticipante_treinamentoId_funcionarioId_key" ON "TreinamentoParticipante"("treinamentoId", "funcionarioId");
