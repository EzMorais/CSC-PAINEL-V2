-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "funcaoSigla" TEXT,
    "foto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ausente" BOOLEAN NOT NULL DEFAULT false,
    "ausenteObs" TEXT,
    "motorista" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT NOT NULL DEFAULT 'CSC',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelo" TEXT NOT NULL,
    "placa" TEXT,
    "motoristaNome" TEXT,
    "foto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Escala" (
    "programacaoId" TEXT NOT NULL,
    "frenteId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "funcionarioId" TEXT,
    "funcionarioLocalId" TEXT,
    "nome" TEXT NOT NULL,
    "funcaoSigla" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,
    CONSTRAINT "Escala_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "Programacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Escala_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Escala_funcionarioLocalId_fkey" FOREIGN KEY ("funcionarioLocalId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Escala" ("frenteId", "funcaoSigla", "funcionarioId", "id", "nome", "observacao", "ordem", "programacaoId") SELECT "frenteId", "funcaoSigla", "funcionarioId", "id", "nome", "observacao", "ordem", "programacaoId" FROM "Escala";
DROP TABLE "Escala";
ALTER TABLE "new_Escala" RENAME TO "Escala";
CREATE INDEX "Escala_programacaoId_idx" ON "Escala"("programacaoId");
CREATE INDEX "Escala_frenteId_idx" ON "Escala"("frenteId");
CREATE UNIQUE INDEX "Escala_programacaoId_frenteId_nome_key" ON "Escala"("programacaoId", "frenteId", "nome");
CREATE TABLE "new_Funcao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargoRh" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "cor" TEXT NOT NULL DEFAULT '#8B0000'
);
INSERT INTO "new_Funcao" ("ativa", "cargoRh", "id", "nome", "ordem", "sigla") SELECT "ativa", "cargoRh", "id", "nome", "ordem", "sigla" FROM "Funcao";
DROP TABLE "Funcao";
ALTER TABLE "new_Funcao" RENAME TO "Funcao";
CREATE UNIQUE INDEX "Funcao_sigla_key" ON "Funcao"("sigla");
CREATE INDEX "Funcao_ordem_idx" ON "Funcao"("ordem");
CREATE TABLE "new_Recurso" (
    "programacaoId" TEXT NOT NULL,
    "frenteId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL DEFAULT 'VEICULO',
    "placa" TEXT,
    "descricao" TEXT NOT NULL,
    "motoristaNome" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "veiculoLocalId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Recurso_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "Programacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recurso_frenteId_fkey" FOREIGN KEY ("frenteId") REFERENCES "Frente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recurso_veiculoLocalId_fkey" FOREIGN KEY ("veiculoLocalId") REFERENCES "Veiculo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recurso" ("descricao", "destaque", "frenteId", "id", "motoristaNome", "ordem", "placa", "programacaoId", "tipo") SELECT "descricao", "destaque", "frenteId", "id", "motoristaNome", "ordem", "placa", "programacaoId", "tipo" FROM "Recurso";
DROP TABLE "Recurso";
ALTER TABLE "new_Recurso" RENAME TO "Recurso";
CREATE INDEX "Recurso_programacaoId_idx" ON "Recurso"("programacaoId");
CREATE INDEX "Recurso_frenteId_idx" ON "Recurso"("frenteId");
CREATE INDEX "Recurso_placa_idx" ON "Recurso"("placa");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Funcionario_ativo_idx" ON "Funcionario"("ativo");
