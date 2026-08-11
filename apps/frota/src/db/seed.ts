import 'dotenv/config';
import { db } from './conexao';
import { veiculos, manutencoes } from './schema';
import dados from './dados-iniciais.json';

type VeiculoJson = {
  nome: string; placa: string; ano: number; renavan: string; chassi: string;
  seguro: string; venc_seguro: string; valor_seguro: number; licenc: string;
  multas: number; taxas: number; km_revisao: number; km_atual: number;
  km_proxima: number; fipe: number; situacao: string; funcionario: string;
  codigo_fipe?: string;
};

type ManutJson = {
  placa: string; problema: string; categoria: string; prioridade: string;
  data: string; previsao: string; status: string; oficina: string;
  custo: string | number; obs: string;
};

async function main() {
  const jaTem = db.select().from(veiculos).all();
  if (jaTem.length > 0) {
    console.log(`Banco já tem ${jaTem.length} veículos. Nada a fazer.`);
    return;
  }

  const vs = dados.veiculos as VeiculoJson[];
  const inseridos = new Map<string, number>();

  for (const v of vs) {
    const r = db.insert(veiculos).values({
      nome: v.nome,
      placa: v.placa || '-',
      ano: v.ano || 0,
      renavam: v.renavan || '-',
      chassi: v.chassi || '',
      seguradora: v.seguro === '-' ? '' : v.seguro || '',
      vencSeguro: v.venc_seguro || '',
      valorSeguro: v.valor_seguro || 0,
      licenciamento: v.licenc || '',
      multas: v.multas || 0,
      taxas: v.taxas || 0,
      kmRevisao: v.km_revisao || 0,
      kmAtual: v.km_atual || 0,
      kmProxima: v.km_proxima || 0,
      fipe: v.fipe || 0,
      codigoFipe: v.codigo_fipe || '',
      situacao: v.situacao || 'PAGO',
      motorista: v.funcionario === '-' ? '' : v.funcionario || '',
      atualizadoEm: new Date(),
    }).returning({ id: veiculos.id, placa: veiculos.placa }).all();

    if (r[0] && r[0].placa !== '-') inseridos.set(r[0].placa, r[0].id);
  }

  const ms = dados.manutencoes as ManutJson[];
  for (const m of ms) {
    const custo = typeof m.custo === 'number' ? m.custo : parseFloat(String(m.custo).replace(',', '.')) || 0;
    db.insert(manutencoes).values({
      veiculoId: inseridos.get(m.placa) ?? null,
      placa: m.placa,
      problema: m.problema,
      categoria: m.categoria || 'Mecânica',
      prioridade: m.prioridade || 'Média',
      dataIdentificacao: m.data || '',
      previsaoSolucao: m.previsao || '',
      status: m.status || 'Aberto',
      oficina: m.oficina || '',
      custo,
      obs: m.obs || '',
    }).run();
  }

  console.log(`OK — ${vs.length} veículos, ${ms.length} manutenções.`);
}

main();
