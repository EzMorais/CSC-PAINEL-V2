-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "lat" REAL,
    "lng" REAL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Alojamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "lat" REAL,
    "lng" REAL,
    "capacidadeTotal" INTEGER,
    "responsavelNome" TEXT,
    "telefoneResponsavel" TEXT,
    "foto" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quarto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "tipo" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alojamentoId" TEXT NOT NULL,
    CONSTRAINT "Quarto_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alocacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funcionarioId" TEXT NOT NULL,
    "funcionarioNome" TEXT NOT NULL,
    "funcionarioMatricula" TEXT NOT NULL,
    "obraCodigo" TEXT,
    "alojamentoId" TEXT NOT NULL,
    "quartoId" TEXT,
    "obraId" TEXT,
    "dataEntrada" DATETIME NOT NULL,
    "dataSaida" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "motivoSaida" TEXT,
    "transporteTipo" TEXT NOT NULL DEFAULT 'PROPRIO',
    "caronaComNome" TEXT,
    "rotaOnibusId" TEXT,
    "observacoes" TEXT,
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Alocacao_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alocacao_quartoId_fkey" FOREIGN KEY ("quartoId") REFERENCES "Quarto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Alocacao_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Alocacao_rotaOnibusId_fkey" FOREIGN KEY ("rotaOnibusId") REFERENCES "RotaOnibus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotaOnibus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "motorista" TEXT,
    "veiculo" TEXT,
    "horarioIda" TEXT,
    "horarioVolta" TEXT,
    "capacidade" INTEGER,
    "obraCodigo" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pedido" (
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
    "registradoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "alojamentoId" TEXT NOT NULL,
    CONSTRAINT "Pedido_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "Alocacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Programacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "horario" TEXT,
    "responsavelNome" TEXT,
    "criadoPor" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "alojamentoId" TEXT,
    CONSTRAINT "Programacao_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DistanciaObra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alojamentoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "distanciaKm" REAL NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "calculadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistanciaObra_alojamentoId_fkey" FOREIGN KEY ("alojamentoId") REFERENCES "Alojamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DistanciaObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigo_key" ON "Obra"("codigo");

-- CreateIndex
CREATE INDEX "Alojamento_ativo_idx" ON "Alojamento"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Quarto_alojamentoId_numero_key" ON "Quarto"("alojamentoId", "numero");

-- CreateIndex
CREATE INDEX "Alocacao_funcionarioId_idx" ON "Alocacao"("funcionarioId");

-- CreateIndex
CREATE INDEX "Alocacao_alojamentoId_idx" ON "Alocacao"("alojamentoId");

-- CreateIndex
CREATE INDEX "Alocacao_status_idx" ON "Alocacao"("status");

-- CreateIndex
CREATE INDEX "RotaOnibus_obraCodigo_idx" ON "RotaOnibus"("obraCodigo");

-- CreateIndex
CREATE INDEX "Pedido_status_idx" ON "Pedido"("status");

-- CreateIndex
CREATE INDEX "Pedido_alojamentoId_idx" ON "Pedido"("alojamentoId");

-- CreateIndex
CREATE INDEX "Pedido_tipo_idx" ON "Pedido"("tipo");

-- CreateIndex
CREATE INDEX "Programacao_data_idx" ON "Programacao"("data");

-- CreateIndex
CREATE INDEX "Programacao_alojamentoId_idx" ON "Programacao"("alojamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "DistanciaObra_alojamentoId_obraId_key" ON "DistanciaObra"("alojamentoId", "obraId");
