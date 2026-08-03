-- CreateTable
CREATE TABLE "ItemCadastro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "detalhe" TEXT,
    "identificador" TEXT,
    "local" TEXT,
    "unidade" TEXT,
    "quantidade" REAL,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ItemCadastro_tipo_idx" ON "ItemCadastro"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCadastro_tipo_codigo_key" ON "ItemCadastro"("tipo", "codigo");
