import type { Veiculo, Manutencao, Abastecimento } from '@/db/schema';

// ── formatação ────────────────────────────────────────────────────────────────
export const brl = (v: number, casas = 0) =>
  (v ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

export const km = (v: number) => (v ?? 0).toLocaleString('pt-BR');

export const litros = (v: number) =>
  `${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;

export function dataBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [a, m, d] = s.split('-');
  return a && m && d ? `${d}/${m}/${a}` : '—';
}

export function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// ── seguro ────────────────────────────────────────────────────────────────────
export function diasAteVencer(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - h.getTime()) / 86_400_000);
}

export type NivelSeguro = 'sem' | 'vencido' | 'critico' | 'atencao' | 'ok';

export function nivelSeguro(v: Pick<Veiculo, 'vencSeguro'>): { nivel: NivelSeguro; dias: number | null } {
  const dias = diasAteVencer(v.vencSeguro);
  if (dias === null) return { nivel: 'sem', dias: null };
  if (dias < 0) return { nivel: 'vencido', dias };
  if (dias <= 30) return { nivel: 'critico', dias };
  if (dias <= 60) return { nivel: 'atencao', dias };
  return { nivel: 'ok', dias };
}

export const rotuloSeguro: Record<NivelSeguro, string> = {
  sem: 'Sem seguro',
  vencido: 'Vencido',
  critico: 'Vence já',
  atencao: 'Atenção',
  ok: 'Em dia',
};

// ── revisão ───────────────────────────────────────────────────────────────────
export type NivelRevisao = 'sem' | 'vencida' | 'proxima' | 'ok';

export function estadoRevisao(v: Pick<Veiculo, 'kmRevisao' | 'kmAtual' | 'kmProxima'>) {
  const { kmRevisao, kmAtual, kmProxima } = v;
  if (!kmProxima) return { nivel: 'sem' as NivelRevisao, restante: 0, pct: 0 };

  const restante = kmProxima - kmAtual;
  const intervalo = kmProxima - kmRevisao;
  const pct = intervalo > 0 ? Math.min(100, Math.max(0, ((kmAtual - kmRevisao) / intervalo) * 100)) : 100;

  const nivel: NivelRevisao = restante <= 0 ? 'vencida' : restante <= 2000 ? 'proxima' : 'ok';
  return { nivel, restante, pct };
}

// ── alertas consolidados ──────────────────────────────────────────────────────
export type Alerta = {
  tipo: 'seguro' | 'revisao' | 'multa' | 'manutencao';
  gravidade: 'alta' | 'media';
  titulo: string;
  detalhe: string;
  veiculoId?: number;
};

export function montarAlertas(
  vs: Veiculo[],
  ms: Manutencao[] = []
): Alerta[] {
  const out: Alerta[] = [];

  for (const v of vs) {
    const { nivel, dias } = nivelSeguro(v);
    if (nivel === 'vencido' || nivel === 'critico' || nivel === 'atencao') {
      out.push({
        tipo: 'seguro',
        gravidade: nivel === 'atencao' ? 'media' : 'alta',
        titulo: `${v.nome} — seguro ${nivel === 'vencido' ? 'vencido' : `vence em ${dias} dias`}`,
        detalhe: `${v.seguradora || 'Seguradora não informada'} · vencimento ${dataBr(v.vencSeguro)} · responsável ${v.motorista || '—'}`,
        veiculoId: v.id,
      });
    }

    const rev = estadoRevisao(v);
    if (rev.nivel === 'vencida' || rev.nivel === 'proxima') {
      out.push({
        tipo: 'revisao',
        gravidade: rev.nivel === 'vencida' ? 'alta' : 'media',
        titulo: `${v.nome} — revisão ${rev.nivel === 'vencida' ? 'vencida' : `em ${km(rev.restante)} km`}`,
        detalhe: `km atual ${km(v.kmAtual)} · próxima ${km(v.kmProxima)} · responsável ${v.motorista || '—'}`,
        veiculoId: v.id,
      });
    }

    if (v.multas > 0) {
      out.push({
        tipo: 'multa',
        gravidade: 'media',
        titulo: `${v.nome} — multa pendente`,
        detalhe: `${brl(v.multas, 2)} · placa ${v.placa} · responsável ${v.motorista || '—'}`,
        veiculoId: v.id,
      });
    }
  }

  const antigas = ms.filter((m) => {
    if (m.status === 'Concluído' || !m.dataIdentificacao) return false;
    const d = diasAteVencer(m.dataIdentificacao);
    return d !== null && d < -30;
  });
  for (const m of antigas) {
    out.push({
      tipo: 'manutencao',
      gravidade: m.prioridade === 'Alta' ? 'alta' : 'media',
      titulo: `${m.placa} — problema aberto há mais de 30 dias`,
      detalhe: `${m.problema.slice(0, 90)} · prioridade ${m.prioridade}`,
    });
  }

  const peso = { alta: 0, media: 1 };
  return out.sort((a, b) => peso[a.gravidade] - peso[b.gravidade]);
}

// ── indicadores de combustível ───────────────────────────────────────────────
export function indicadoresCombustivel(abs: Abastecimento[]) {
  const totalGasto = abs.reduce((s, a) => s + (a.valorTotal || 0), 0);
  const totalLitros = abs.reduce((s, a) => s + (a.litros || 0), 0);
  const custoMedio = totalLitros ? totalGasto / totalLitros : 0;

  const porVeiculo = new Map<string, { placa: string; veiculo: string; litros: number; valor: number; qtd: number }>();
  for (const a of abs) {
    const k = a.placa || 'S/PLACA';
    const at = porVeiculo.get(k) ?? { placa: k, veiculo: k, litros: 0, valor: 0, qtd: 0 };
    at.litros += a.litros || 0;
    at.valor += a.valorTotal || 0;
    at.qtd += 1;
    porVeiculo.set(k, at);
  }

  const porCombustivel = new Map<string, { combustivel: string; litros: number; valor: number }>();
  for (const a of abs) {
    const k = a.combustivel || '—';
    const at = porCombustivel.get(k) ?? { combustivel: k, litros: 0, valor: 0 };
    at.litros += a.litros || 0;
    at.valor += a.valorTotal || 0;
    porCombustivel.set(k, at);
  }

  const porMes = new Map<string, { mes: string; litros: number; valor: number }>();
  for (const a of abs) {
    const k = String(a.data).slice(0, 7);
    if (!k) continue;
    const at = porMes.get(k) ?? { mes: k, litros: 0, valor: 0 };
    at.litros += a.litros || 0;
    at.valor += a.valorTotal || 0;
    porMes.set(k, at);
  }

  return {
    totalGasto,
    totalLitros,
    custoMedio,
    qtd: abs.length,
    porVeiculo: [...porVeiculo.values()].sort((a, b) => b.valor - a.valor),
    porCombustivel: [...porCombustivel.values()].sort((a, b) => b.valor - a.valor),
    porMes: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}
