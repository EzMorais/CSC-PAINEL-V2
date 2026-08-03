-- AlterTable
ALTER TABLE "Alojamento" ADD COLUMN "grupoWhatsappId" TEXT;

-- AlterTable
ALTER TABLE "MensagemWhatsapp" ADD COLUMN "grupoId" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "grupoOrigemId" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "nomeOrigem" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Alojamento_grupoWhatsappId_key" ON "Alojamento"("grupoWhatsappId");

