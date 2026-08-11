import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';

// Guarda a instância no globalThis para sobreviver ao hot-reload do Next em dev.
const g = globalThis as unknown as { __frotaDb?: ReturnType<typeof criar> };

function criarTabelas(sqlite: Database) {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'OPERADOR',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS veiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      placa TEXT NOT NULL DEFAULT '-',
      ano INTEGER NOT NULL DEFAULT 0,
      renavam TEXT NOT NULL DEFAULT '-',
      chassi TEXT NOT NULL DEFAULT '',
      seguradora TEXT NOT NULL DEFAULT '',
      venc_seguro TEXT NOT NULL DEFAULT '',
      valor_seguro REAL NOT NULL DEFAULT 0,
      licenciamento TEXT NOT NULL DEFAULT '',
      multas REAL NOT NULL DEFAULT 0,
      taxas REAL NOT NULL DEFAULT 0,
      km_revisao INTEGER NOT NULL DEFAULT 0,
      km_atual INTEGER NOT NULL DEFAULT 0,
      km_proxima INTEGER NOT NULL DEFAULT 0,
      fipe REAL NOT NULL DEFAULT 0,
      codigo_fipe TEXT NOT NULL DEFAULT '',
      fipe_referencia TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT 'PAGO',
      motorista TEXT NOT NULL DEFAULT '',
      atualizado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);

    CREATE TABLE IF NOT EXISTS trocas_motorista (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      de TEXT NOT NULL DEFAULT '',
      para TEXT NOT NULL DEFAULT '',
      motivo TEXT NOT NULL DEFAULT '',
      em INTEGER NOT NULL,
      usuario_nome TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_trocas_veiculo ON trocas_motorista(veiculo_id);

    CREATE TABLE IF NOT EXISTS manutencoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veiculo_id INTEGER REFERENCES veiculos(id) ON DELETE SET NULL,
      placa TEXT NOT NULL DEFAULT '',
      problema TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Mecânica',
      prioridade TEXT NOT NULL DEFAULT 'Média',
      data_identificacao TEXT NOT NULL DEFAULT '',
      previsao_solucao TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Aberto',
      oficina TEXT NOT NULL DEFAULT '',
      custo REAL NOT NULL DEFAULT 0,
      obs TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_manut_placa ON manutencoes(placa);
    CREATE INDEX IF NOT EXISTS idx_manut_status ON manutencoes(status);

    CREATE TABLE IF NOT EXISTS anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manutencao_id INTEGER NOT NULL REFERENCES manutencoes(id) ON DELETE CASCADE,
      nome_arquivo TEXT NOT NULL,
      caminho TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT '',
      tamanho INTEGER NOT NULL DEFAULT 0,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_anexos_manut ON anexos(manutencao_id);

    CREATE TABLE IF NOT EXISTS abastecimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veiculo_id INTEGER REFERENCES veiculos(id) ON DELETE SET NULL,
      placa TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '',
      combustivel TEXT NOT NULL DEFAULT '',
      litros REAL NOT NULL DEFAULT 0,
      valor_total REAL NOT NULL DEFAULT 0,
      km INTEGER NOT NULL DEFAULT 0,
      posto TEXT NOT NULL DEFAULT '',
      obs TEXT NOT NULL DEFAULT '',
      usuario_nome TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_abast_placa ON abastecimentos(placa);
    CREATE INDEX IF NOT EXISTS idx_abast_data ON abastecimentos(data);

    CREATE TABLE IF NOT EXISTS veiculos_autorizados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT NOT NULL UNIQUE,
      uf TEXT NOT NULL DEFAULT 'SP',
      modelo TEXT NOT NULL DEFAULT '',
      fabricante TEXT NOT NULL DEFAULT '',
      ano INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Autorizado',
      combustiveis TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL DEFAULT ''
    );
  `);
}

function criar() {
  const url = process.env.DATABASE_URL ?? 'file:./frota.db';
  // Durante `next build`, vários workers podem importar rotas simultaneamente. Abrir o
  // SQLite de produção em cada worker provoca `database is locked` ainda na coleta de
  // páginas. O build só precisa do schema para compilar; cada worker recebe um banco em
  // memória e a execução normal continua usando DATABASE_URL.
  const emBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const arquivo = emBuild ? ':memory:' : url.replace(/^file:/, '');
  const abs = arquivo === ':memory:' ? arquivo : path.isAbsolute(arquivo) ? arquivo : path.join(process.cwd(), arquivo);
  if (abs !== ':memory:') fs.mkdirSync(path.dirname(abs), { recursive: true });

  const sqlite = new Database(abs);
  criarTabelas(sqlite);

  // As tabelas são criadas automaticamente, então um caminho errado produz um
  // banco vazio que "funciona" em silêncio — é fácil não perceber. Este aviso
  // no boot mostra qual arquivo está em uso e quantos registros ele tem.
  try {
    const r = sqlite.prepare('SELECT COUNT(*) AS n FROM veiculos').get() as { n?: number } | undefined;
    const n = Number(r?.n ?? 0);
    console.log(`[frota] banco: ${emBuild ? 'memória de build' : abs} (${n} veículo${n === 1 ? '' : 's'})`);
    if (n === 0) {
      console.warn('[frota] ATENÇÃO: nenhum veículo neste banco.');
      console.warn('[frota] Se você esperava dados, confira o DATABASE_URL — o caminho');
      console.warn('[frota] pode estar apontando para um arquivo novo e vazio.');
    }
  } catch {
    // se a contagem falhar não é motivo para derrubar a aplicação
  }

  return drizzle(sqlite, { schema });
}

export const db = g.__frotaDb ?? criar();
if (process.env.NODE_ENV !== 'production') g.__frotaDb = db;

export * from './schema';
