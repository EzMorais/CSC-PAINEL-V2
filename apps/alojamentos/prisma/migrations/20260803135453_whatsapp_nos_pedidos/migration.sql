-- AlterTable
ALTER TABLE "Alocacao" ADD COLUMN "telefone" TEXT;

-- CreateTable
CREATE TABLE "ConversaWhatsapp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telefone" TEXT NOT NULL,
    "passo" TEXT NOT NULL,
    "tipoEscolhido" TEXT,
    "descricao" TEXT,
    "alocacaoId" TEXT,
    "expiraEm" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "ConversaWhatsapp_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "Alocacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MensagemWhatsapp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telefone" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "externoId" TEXT,
    "pedidoId" TEXT,
    "erro" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
    "alocacaoId" TEXT,
    "funcionarioNome" TEXT,
    "atendidoPor" TEXT,
    "atendidoEm" DATETIME,
    "respostaObservacao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
    "telefoneOrigem" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "alojamentoId" TEXT NOT NULL,
    CONSTRAINT "Pedido_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "Alocacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("alocacaoId", "alojamentoId", "atendidoEm", "atendidoPor", "atualizadoEm", "criadoEm", "descricao", "funcionarioNome", "id", "prioridade", "registradoPor", "respostaObservacao", "status", "tipo", "titulo") SELECT "alocacaoId", "alojamentoId", "atendidoEm", "atendidoPor", "atualizadoEm", "criadoEm", "descricao", "funcionarioNome", "id", "prioridade", "registradoPor", "respostaObservacao", "status", "tipo", "titulo" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
CREATE INDEX "Pedido_status_idx" ON "Pedido"("status");
CREATE INDEX "Pedido_alojamentoId_idx" ON "Pedido"("alojamentoId");
CREATE INDEX "Pedido_tipo_idx" ON "Pedido"("tipo");
CREATE INDEX "Pedido_telefoneOrigem_idx" ON "Pedido"("telefoneOrigem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsapp_telefone_key" ON "ConversaWhatsapp"("telefone");

-- CreateIndex
CREATE INDEX "ConversaWhatsapp_expiraEm_idx" ON "ConversaWhatsapp"("expiraEm");

-- CreateIndex
CREATE INDEX "MensagemWhatsapp_telefone_idx" ON "MensagemWhatsapp"("telefone");

-- CreateIndex
CREATE INDEX "MensagemWhatsapp_criadoEm_idx" ON "MensagemWhatsapp"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsapp_externoId_direcao_key" ON "MensagemWhatsapp"("externoId", "direcao");

-- CreateIndex
CREATE INDEX "Alocacao_telefone_idx" ON "Alocacao"("telefone");
