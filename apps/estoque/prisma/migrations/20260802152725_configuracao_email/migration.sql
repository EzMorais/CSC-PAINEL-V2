-- AlterTable
ALTER TABLE "SolicitacaoCompra" ADD COLUMN "emailEnviadoEm" DATETIME;
ALTER TABLE "SolicitacaoCompra" ADD COLUMN "emailEnviadoPara" TEXT;
ALTER TABLE "SolicitacaoCompra" ADD COLUMN "emailErro" TEXT;

-- CreateTable
CREATE TABLE "ConfiguracaoEmail" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'unica',
    "provedor" TEXT NOT NULL DEFAULT 'GMAIL',
    "host" TEXT NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 587,
    "usuario" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "remetente" TEXT,
    "destinatarioPadrao" TEXT,
    "copiaPara" TEXT,
    "enviarAutomatico" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "testadoEm" DATETIME,
    "atualizadoEm" DATETIME NOT NULL
);
