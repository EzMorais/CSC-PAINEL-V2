-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "cargo" TEXT NOT NULL DEFAULT 'OPERACIONAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "telefone" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "ultimoAcesso" DATETIME
);

-- CreateTable
CREATE TABLE "AcessoModulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modulo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "AcessoModulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistroAcesso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "sucesso" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "ocorrido" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_cargo_idx" ON "Usuario"("cargo");

-- CreateIndex
CREATE INDEX "AcessoModulo_modulo_idx" ON "AcessoModulo"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "AcessoModulo_usuarioId_modulo_key" ON "AcessoModulo"("usuarioId", "modulo");

-- CreateIndex
CREATE INDEX "RegistroAcesso_ocorrido_idx" ON "RegistroAcesso"("ocorrido");

-- CreateIndex
CREATE INDEX "RegistroAcesso_email_idx" ON "RegistroAcesso"("email");
