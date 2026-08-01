-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cbo" TEXT,
    "risco" TEXT NOT NULL DEFAULT 'NORMAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "dataNascimento" DATETIME,
    "sexo" TEXT,
    "estadoCivil" TEXT,
    "nomeMae" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "admitidoEm" DATETIME NOT NULL,
    "demitidoEm" DATETIME,
    "motivoSaida" TEXT,
    "salario" REAL,
    "tipoContrato" TEXT NOT NULL DEFAULT 'CLT',
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "tipoConta" TEXT,
    "chavePix" TEXT,
    "tamanhoCamisa" TEXT,
    "tamanhoCalca" TEXT,
    "tamanhoCalcado" TEXT,
    "observacoes" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "obraId" TEXT,
    "cargoId" TEXT,
    CONSTRAINT "Funcionario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Funcionario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dependente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "dataNascimento" DATETIME,
    "cpf" TEXT,
    "irrf" BOOLEAN NOT NULL DEFAULT false,
    "salarioFamilia" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "funcionarioId" TEXT NOT NULL,
    CONSTRAINT "Dependente_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "descricaoHumana" TEXT NOT NULL,
    "detalhe" TEXT,
    "ocorridoEm" DATETIME NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPor" TEXT,
    "funcionarioId" TEXT NOT NULL,
    "obraId" TEXT,
    CONSTRAINT "Evento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evento_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigo_key" ON "Obra"("codigo");

-- CreateIndex
CREATE INDEX "Obra_cliente_idx" ON "Obra"("cliente");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nome_key" ON "Cargo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "Funcionario"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_cpf_key" ON "Funcionario"("cpf");

-- CreateIndex
CREATE INDEX "Funcionario_obraId_idx" ON "Funcionario"("obraId");

-- CreateIndex
CREATE INDEX "Funcionario_cargoId_idx" ON "Funcionario"("cargoId");

-- CreateIndex
CREATE INDEX "Funcionario_status_idx" ON "Funcionario"("status");

-- CreateIndex
CREATE INDEX "Funcionario_nome_idx" ON "Funcionario"("nome");

-- CreateIndex
CREATE INDEX "Dependente_funcionarioId_idx" ON "Dependente"("funcionarioId");

-- CreateIndex
CREATE INDEX "Evento_funcionarioId_ocorridoEm_idx" ON "Evento"("funcionarioId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "Evento_obraId_idx" ON "Evento"("obraId");

-- CreateIndex
CREATE INDEX "Evento_tipo_idx" ON "Evento"("tipo");
