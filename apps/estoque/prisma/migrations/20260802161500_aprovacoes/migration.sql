-- Fila de aprovação: o que o cargo Operacional pede e a gerência autoriza.
CREATE TABLE "Aprovacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "dados" TEXT NOT NULL,
    "motivo" TEXT,
    "resumo" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "solicitanteNome" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "aprovadorNome" TEXT,
    "motivoRejeicao" TEXT,
    "referenciaId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" DATETIME
);
CREATE INDEX "Aprovacao_status_criadoEm_idx" ON "Aprovacao"("status", "criadoEm");
CREATE INDEX "Aprovacao_tipo_idx" ON "Aprovacao"("tipo");

-- Limites que decidem quando a aprovação é exigida.
ALTER TABLE "ConfiguracaoEmail" ADD COLUMN "limiteAprovacaoCompra" REAL NOT NULL DEFAULT 1000;
ALTER TABLE "ConfiguracaoEmail" ADD COLUMN "limiteAjusteInventario" REAL NOT NULL DEFAULT 10;
