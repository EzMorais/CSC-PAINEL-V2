'use server';

import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import {
  db, veiculos, manutencoes, abastecimentos, veiculosAutorizados,
  trocasMotorista, anexos,
} from '@/db';
import { exigirSessao } from '@/lib/auth';

const num = (v: FormDataEntryValue | null) => {
  if (v === null) return 0;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const int = (v: FormDataEntryValue | null) => Math.round(num(v));
const txt = (v: FormDataEntryValue | null) => String(v ?? '').trim();

// ── veículos ──────────────────────────────────────────────────────────────────
export async function salvarVeiculo(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id') ?? 0);

  const dados = {
    nome: txt(fd.get('nome')),
    placa: txt(fd.get('placa')) || '-',
    ano: int(fd.get('ano')),
    renavam: txt(fd.get('renavam')) || '-',
    chassi: txt(fd.get('chassi')),
    seguradora: txt(fd.get('seguradora')),
    vencSeguro: txt(fd.get('vencSeguro')),
    valorSeguro: num(fd.get('valorSeguro')),
    licenciamento: txt(fd.get('licenciamento')),
    multas: num(fd.get('multas')),
    taxas: num(fd.get('taxas')),
    kmRevisao: int(fd.get('kmRevisao')),
    kmAtual: int(fd.get('kmAtual')),
    kmProxima: int(fd.get('kmProxima')),
    fipe: num(fd.get('fipe')),
    codigoFipe: txt(fd.get('codigoFipe')),
    situacao: txt(fd.get('situacao')) || 'PAGO',
    motorista: txt(fd.get('motorista')),
    atualizadoEm: new Date(),
  };

  if (!dados.nome) return;

  if (id) db.update(veiculos).set(dados).where(eq(veiculos.id, id)).run();
  else db.insert(veiculos).values(dados).run();

  revalidatePath('/veiculos');
  revalidatePath('/alertas');
}

export async function trocarMotorista(fd: FormData) {
  const s = await exigirSessao();
  const id = Number(fd.get('id'));
  const para = txt(fd.get('motorista'));
  const motivo = txt(fd.get('motivo'));
  if (!id) return;

  const v = db.select().from(veiculos).where(eq(veiculos.id, id)).get();
  if (!v || v.motorista === para) return;

  db.insert(trocasMotorista).values({
    veiculoId: id, de: v.motorista, para, motivo,
    em: new Date(), usuarioNome: s.nome,
  }).run();

  db.update(veiculos).set({ motorista: para, atualizadoEm: new Date() })
    .where(eq(veiculos.id, id)).run();

  revalidatePath('/veiculos');
}

export async function atualizarKm(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id'));
  const kmAtual = int(fd.get('kmAtual'));
  if (!id) return;
  db.update(veiculos).set({ kmAtual, atualizadoEm: new Date() }).where(eq(veiculos.id, id)).run();
  revalidatePath('/veiculos');
  revalidatePath('/alertas');
}

export async function removerVeiculo(fd: FormData) {
  const s = await exigirSessao();
  if (s.papel !== 'ADMIN') return;
  const id = Number(fd.get('id'));
  if (id) db.delete(veiculos).where(eq(veiculos.id, id)).run();
  revalidatePath('/veiculos');
}

export async function historicoMotorista(veiculoId: number) {
  await exigirSessao();
  return db.select().from(trocasMotorista)
    .where(eq(trocasMotorista.veiculoId, veiculoId))
    .orderBy(desc(trocasMotorista.em)).all();
}

// ── manutenções ───────────────────────────────────────────────────────────────
export async function salvarManutencao(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id') ?? 0);
  const placa = txt(fd.get('placa'));
  const v = placa ? db.select().from(veiculos).where(eq(veiculos.placa, placa)).get() : null;

  const dados = {
    veiculoId: v?.id ?? null,
    placa,
    problema: txt(fd.get('problema')),
    categoria: txt(fd.get('categoria')) || 'Mecânica',
    prioridade: txt(fd.get('prioridade')) || 'Média',
    dataIdentificacao: txt(fd.get('dataIdentificacao')),
    previsaoSolucao: txt(fd.get('previsaoSolucao')),
    status: txt(fd.get('status')) || 'Aberto',
    oficina: txt(fd.get('oficina')),
    custo: num(fd.get('custo')),
    obs: txt(fd.get('obs')),
  };
  if (!dados.problema) return;

  if (id) db.update(manutencoes).set(dados).where(eq(manutencoes.id, id)).run();
  else db.insert(manutencoes).values(dados).run();

  revalidatePath('/manutencoes');
  revalidatePath('/alertas');
}

export async function mudarStatusManutencao(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id'));
  const status = txt(fd.get('status'));
  if (!id || !status) return;
  db.update(manutencoes).set({ status }).where(eq(manutencoes.id, id)).run();
  revalidatePath('/manutencoes');
  revalidatePath('/alertas');
}

export async function removerManutencao(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id'));
  if (id) db.delete(manutencoes).where(eq(manutencoes.id, id)).run();
  revalidatePath('/manutencoes');
}

export async function anexarFoto(fd: FormData) {
  await exigirSessao();
  const manutencaoId = Number(fd.get('manutencaoId'));
  const arquivo = fd.get('arquivo') as File | null;
  if (!manutencaoId || !arquivo || arquivo.size === 0) return;

  const MAX = 8 * 1024 * 1024;
  if (arquivo.size > MAX) return;

  const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!permitidos.includes(arquivo.type)) return;

  const pasta = process.env.PASTA_ANEXOS || './public/anexos';
  const abs = path.isAbsolute(pasta) ? pasta : path.join(process.cwd(), pasta);
  await fs.mkdir(abs, { recursive: true });

  const ext = path.extname(arquivo.name).slice(0, 10) || '.bin';
  const nome = `m${manutencaoId}-${Date.now()}${ext}`;
  await fs.writeFile(path.join(abs, nome), Buffer.from(await arquivo.arrayBuffer()));

  db.insert(anexos).values({
    manutencaoId,
    nomeArquivo: arquivo.name.slice(0, 120),
    caminho: `/anexos/${nome}`,
    mime: arquivo.type,
    tamanho: arquivo.size,
    criadoEm: new Date(),
  }).run();

  revalidatePath('/manutencoes');
}

// ── abastecimento ─────────────────────────────────────────────────────────────
export async function salvarAbastecimento(fd: FormData) {
  const s = await exigirSessao();
  const id = Number(fd.get('id') ?? 0);
  const placa = txt(fd.get('placa'));
  const v = placa ? db.select().from(veiculos).where(eq(veiculos.placa, placa)).get() : null;

  const dados = {
    veiculoId: v?.id ?? null,
    placa,
    data: txt(fd.get('data')),
    combustivel: txt(fd.get('combustivel')),
    litros: num(fd.get('litros')),
    valorTotal: num(fd.get('valorTotal')),
    km: int(fd.get('km')),
    posto: txt(fd.get('posto')),
    obs: txt(fd.get('obs')),
    usuarioNome: s.nome,
  };
  if (!dados.placa) return;

  if (id) db.update(abastecimentos).set(dados).where(eq(abastecimentos.id, id)).run();
  else db.insert(abastecimentos).values(dados).run();

  // o abastecimento é a leitura de km mais confiável que existe
  if (v && dados.km > v.kmAtual) {
    db.update(veiculos).set({ kmAtual: dados.km, atualizadoEm: new Date() })
      .where(eq(veiculos.id, v.id)).run();
  }

  revalidatePath('/abastecimento');
  revalidatePath('/veiculos');
}

export async function removerAbastecimento(fd: FormData) {
  await exigirSessao();
  const id = Number(fd.get('id'));
  if (id) db.delete(abastecimentos).where(eq(abastecimentos.id, id)).run();
  revalidatePath('/abastecimento');
}

/** Importa o CSV exportado pelo sistema do posto. */
export async function importarCsvPosto(_estado: unknown, fd: FormData) {
  await exigirSessao();
  const arquivo = fd.get('arquivo') as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: 'Escolha um arquivo CSV.' };

  const texto = new TextDecoder('utf-8').decode(await arquivo.arrayBuffer()).replace(/^\uFEFF/, '');
  const sep = (texto.match(/;/g)?.length ?? 0) > (texto.match(/,/g)?.length ?? 0) ? ';' : ',';

  const { data, meta } = Papa.parse<Record<string, string>>(texto, {
    header: true, delimiter: sep, skipEmptyLines: true,
  });

  const colunas = meta.fields ?? [];
  const chave = (linha: Record<string, string>, nomes: string[]) => {
    for (const k of Object.keys(linha)) {
      if (nomes.includes(k.toLowerCase().trim().replace(/\s+/g, '_'))) return linha[k];
    }
    return '';
  };

  const COL_LITROS = ['litros', 'quantidade', 'qtd', 'volume', 'consumo', 'litros_abastecidos'];
  const COL_VALOR = ['valor', 'valor_total', 'preco', 'custo', 'total', 'valor_abastecimento'];
  const COL_DATA = ['data', 'date', 'data_abastecimento', 'data_consumo'];
  const COL_KM = ['km', 'quilometragem', 'hodometro', 'odometro', 'km_atual'];
  const COL_COMB = ['combustivel', 'tipo_combustivel', 'produto', 'combustiveis'];
  const COL_POSTO = ['posto', 'fornecedor', 'local', 'unidade'];

  let autorizados = 0;
  let lancamentos = 0;

  for (const linha of data) {
    const placa = String(linha.placa ?? linha.PLACA ?? '').trim().toUpperCase();
    if (!placa) continue;

    const registro = {
      placa,
      uf: String(linha.uf ?? linha.UF ?? 'SP').trim() || 'SP',
      modelo: String(linha.modelo ?? linha.MODELO ?? '').trim(),
      fabricante: String(linha.fabricante ?? linha.FABRICANTE ?? '').trim(),
      ano: parseInt(String(linha.ano ?? '0'), 10) || 0,
      status: String(linha.status ?? 'Autorizado').trim(),
      combustiveis: String(linha.combustiveis ?? linha.combustivel ?? '').trim(),
    };

    const existe = db.select().from(veiculosAutorizados)
      .where(eq(veiculosAutorizados.placa, placa)).get();
    if (existe) db.update(veiculosAutorizados).set(registro).where(eq(veiculosAutorizados.placa, placa)).run();
    else db.insert(veiculosAutorizados).values(registro).run();
    autorizados++;

    const litros = num(chave(linha, COL_LITROS));
    const valor = num(chave(linha, COL_VALOR));
    if (litros > 0 || valor > 0) {
      const v = db.select().from(veiculos).where(eq(veiculos.placa, placa)).get();
      db.insert(abastecimentos).values({
        veiculoId: v?.id ?? null,
        placa,
        data: String(chave(linha, COL_DATA) || new Date().toISOString().slice(0, 10)).slice(0, 10),
        combustivel: String(chave(linha, COL_COMB) || registro.combustiveis),
        litros,
        valorTotal: valor,
        km: int(chave(linha, COL_KM)),
        posto: String(chave(linha, COL_POSTO)),
        obs: '',
        usuarioNome: 'importação',
      }).run();
      lancamentos++;
    }
  }

  revalidatePath('/abastecimento');
  return {
    ok: true,
    autorizados,
    lancamentos,
    colunas,
    aviso: lancamentos === 0
      ? 'Nenhuma coluna de litros ou valor foi encontrada — só o cadastro de veículos foi atualizado.'
      : '',
  };
}
