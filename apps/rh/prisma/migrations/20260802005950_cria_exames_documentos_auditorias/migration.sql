-- CreateTable
CREATE TABLE "Exame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "realizadoEm" DATETIME NOT NULL,
    "validadeEm" DATETIME,
    "resultado" TEXT NOT NULL,
    "restricoes" TEXT,
    "arquivo" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "funcionarioId" TEXT NOT NULL,
    CONSTRAINT "Exame_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "vigenteDesde" DATETIME,
    "validoAte" DATETIME,
    "arquivo" TEXT,
    "observacao" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obraId" TEXT,
    "funcionarioId" TEXT,
    CONSTRAINT "Documento_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Documento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "norma" TEXT,
    "realizadaEm" DATETIME NOT NULL,
    "responsavel" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obraId" TEXT,
    CONSTRAINT "Auditoria_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditoriaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descricao" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "evidencia" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditoriaId" TEXT NOT NULL,
    CONSTRAINT "AuditoriaItem_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "Auditoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NaoConformidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "responsavel" TEXT,
    "prazo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "evidenciaAntes" TEXT,
    "evidenciaDepois" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" DATETIME,
    "auditoriaItemId" TEXT,
    CONSTRAINT "NaoConformidade_auditoriaItemId_fkey" FOREIGN KEY ("auditoriaItemId") REFERENCES "AuditoriaItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Exame_funcionarioId_realizadoEm_idx" ON "Exame"("funcionarioId", "realizadoEm");

-- CreateIndex
CREATE INDEX "Exame_validadeEm_idx" ON "Exame"("validadeEm");

-- CreateIndex
CREATE INDEX "Documento_categoria_idx" ON "Documento"("categoria");

-- CreateIndex
CREATE INDEX "Documento_obraId_idx" ON "Documento"("obraId");

-- CreateIndex
CREATE INDEX "Documento_funcionarioId_idx" ON "Documento"("funcionarioId");

-- CreateIndex
CREATE INDEX "Documento_validoAte_idx" ON "Documento"("validoAte");

-- CreateIndex
CREATE INDEX "Auditoria_realizadaEm_idx" ON "Auditoria"("realizadaEm");

-- CreateIndex
CREATE INDEX "Auditoria_obraId_idx" ON "Auditoria"("obraId");

-- CreateIndex
CREATE INDEX "AuditoriaItem_auditoriaId_idx" ON "AuditoriaItem"("auditoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "NaoConformidade_auditoriaItemId_key" ON "NaoConformidade"("auditoriaItemId");

-- CreateIndex
CREATE INDEX "NaoConformidade_status_idx" ON "NaoConformidade"("status");

-- CreateIndex
CREATE INDEX "NaoConformidade_gravidade_idx" ON "NaoConformidade"("gravidade");
