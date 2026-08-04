-- CreateTable
CREATE TABLE "Frente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#DDEBF7',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "colunas" INTEGER NOT NULL DEFAULT 1,
    "obraCodigo" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Programacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "publicadaEm" DATETIME,
    "publicadaPor" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Escala" (
    "programacaoId" TEXT NOT NULL,
    "frenteId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "funcionarioId" TEXT,
    "nome" TEXT NOT NULL,
    "funcaoSigla" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,
    CONSTRAINT "Escala_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "Programacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Escala_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recurso" (
    "programacaoId" TEXT NOT NULL,
    "frenteId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL DEFAULT 'VEICULO',
    "placa" TEXT,
    "descricao" TEXT NOT NULL,
    "motoristaNome" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Recurso_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "Programacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recurso_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Funcao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargoRh" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "Frente_nome_key" ON "Frente"("nome");

-- CreateIndex
CREATE INDEX "Frente_ordem_idx" ON "Frente"("ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Programacao_data_key" ON "Programacao"("data");

-- CreateIndex
CREATE INDEX "Programacao_data_idx" ON "Programacao"("data");

-- CreateIndex
CREATE INDEX "Escala_programacaoId_idx" ON "Escala"("programacaoId");

-- CreateIndex
CREATE INDEX "Escala_frenteId_idx" ON "Escala"("frenteId");

-- CreateIndex
CREATE UNIQUE INDEX "Escala_programacaoId_frenteId_nome_key" ON "Escala"("programacaoId", "frenteId", "nome");

-- CreateIndex
CREATE INDEX "Recurso_programacaoId_idx" ON "Recurso"("programacaoId");

-- CreateIndex
CREATE INDEX "Recurso_frenteId_idx" ON "Recurso"("frenteId");

-- CreateIndex
CREATE INDEX "Recurso_placa_idx" ON "Recurso"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_sigla_key" ON "Funcao"("sigla");

-- CreateIndex
CREATE INDEX "Funcao_ordem_idx" ON "Funcao"("ordem");
