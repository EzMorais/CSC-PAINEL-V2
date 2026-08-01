import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core';

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  papel: text('papel').notNull().default('OPERADOR'), // ADMIN | OPERADOR
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  criadoEm: integer('criado_em', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const veiculos = sqliteTable(
  'veiculos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nome: text('nome').notNull(),
    placa: text('placa').notNull().default('-'),
    ano: integer('ano').notNull().default(0),
    renavam: text('renavam').notNull().default('-'),
    chassi: text('chassi').notNull().default(''),

    seguradora: text('seguradora').notNull().default(''),
    vencSeguro: text('venc_seguro').notNull().default(''), // ISO yyyy-mm-dd
    valorSeguro: real('valor_seguro').notNull().default(0),

    licenciamento: text('licenciamento').notNull().default(''),
    multas: real('multas').notNull().default(0),
    taxas: real('taxas').notNull().default(0),

    kmRevisao: integer('km_revisao').notNull().default(0),
    kmAtual: integer('km_atual').notNull().default(0),
    kmProxima: integer('km_proxima').notNull().default(0),

    fipe: real('fipe').notNull().default(0),
    codigoFipe: text('codigo_fipe').notNull().default(''),
    fipeReferencia: text('fipe_referencia').notNull().default(''),

    situacao: text('situacao').notNull().default('PAGO'),
    motorista: text('motorista').notNull().default(''),

    atualizadoEm: integer('atualizado_em', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({ idxPlaca: index('idx_veiculos_placa').on(t.placa) })
);

export const trocasMotorista = sqliteTable(
  'trocas_motorista',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    veiculoId: integer('veiculo_id').notNull().references(() => veiculos.id, { onDelete: 'cascade' }),
    de: text('de').notNull().default(''),
    para: text('para').notNull().default(''),
    motivo: text('motivo').notNull().default(''),
    em: integer('em', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    usuarioNome: text('usuario_nome').notNull().default(''),
  },
  (t) => ({ idxVeiculo: index('idx_trocas_veiculo').on(t.veiculoId) })
);

export const manutencoes = sqliteTable(
  'manutencoes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    veiculoId: integer('veiculo_id').references(() => veiculos.id, { onDelete: 'set null' }),
    placa: text('placa').notNull().default(''),
    problema: text('problema').notNull(),
    categoria: text('categoria').notNull().default('Mecânica'),
    prioridade: text('prioridade').notNull().default('Média'),
    dataIdentificacao: text('data_identificacao').notNull().default(''),
    previsaoSolucao: text('previsao_solucao').notNull().default(''),
    status: text('status').notNull().default('Aberto'),
    oficina: text('oficina').notNull().default(''),
    custo: real('custo').notNull().default(0),
    obs: text('obs').notNull().default(''),
  },
  (t) => ({
    idxPlaca: index('idx_manut_placa').on(t.placa),
    idxStatus: index('idx_manut_status').on(t.status),
  })
);

export const anexos = sqliteTable(
  'anexos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    manutencaoId: integer('manutencao_id').notNull().references(() => manutencoes.id, { onDelete: 'cascade' }),
    nomeArquivo: text('nome_arquivo').notNull(),
    caminho: text('caminho').notNull(),
    mime: text('mime').notNull().default(''),
    tamanho: integer('tamanho').notNull().default(0),
    criadoEm: integer('criado_em', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({ idxManut: index('idx_anexos_manut').on(t.manutencaoId) })
);

export const abastecimentos = sqliteTable(
  'abastecimentos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    veiculoId: integer('veiculo_id').references(() => veiculos.id, { onDelete: 'set null' }),
    placa: text('placa').notNull().default(''),
    data: text('data').notNull().default(''),
    combustivel: text('combustivel').notNull().default(''),
    litros: real('litros').notNull().default(0),
    valorTotal: real('valor_total').notNull().default(0),
    km: integer('km').notNull().default(0),
    posto: text('posto').notNull().default(''),
    obs: text('obs').notNull().default(''),
    usuarioNome: text('usuario_nome').notNull().default(''),
  },
  (t) => ({
    idxPlaca: index('idx_abast_placa').on(t.placa),
    idxData: index('idx_abast_data').on(t.data),
  })
);

export const veiculosAutorizados = sqliteTable('veiculos_autorizados', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  placa: text('placa').notNull().unique(),
  uf: text('uf').notNull().default('SP'),
  modelo: text('modelo').notNull().default(''),
  fabricante: text('fabricante').notNull().default(''),
  ano: integer('ano').notNull().default(0),
  status: text('status').notNull().default('Autorizado'),
  combustiveis: text('combustiveis').notNull().default(''),
});

export const config = sqliteTable('config', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull().default(''),
});

export type Veiculo = typeof veiculos.$inferSelect;
export type Manutencao = typeof manutencoes.$inferSelect;
export type Abastecimento = typeof abastecimentos.$inferSelect;
export type VeiculoAutorizado = typeof veiculosAutorizados.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type TrocaMotorista = typeof trocasMotorista.$inferSelect;
export type Anexo = typeof anexos.$inferSelect;
