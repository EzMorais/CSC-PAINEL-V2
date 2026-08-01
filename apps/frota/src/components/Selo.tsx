import clsx from 'clsx';
import type { NivelSeguro, NivelRevisao } from '@/lib/frota';

const estilosSeguro: Record<NivelSeguro, string> = {
  vencido: 'bg-sinal/12 text-sinal',
  critico: 'bg-ambar/15 text-ambar',
  atencao: 'bg-aco-fraco text-aco',
  ok: 'bg-mata-fraco text-mata',
  sem: 'bg-concreto-200 text-grafite-600',
};

export function SeloSeguro({ nivel, dias }: { nivel: NivelSeguro; dias: number | null }) {
  const texto =
    nivel === 'sem' ? 'sem seguro'
    : nivel === 'vencido' ? `vencido há ${Math.abs(dias!)}d`
    : nivel === 'ok' ? 'em dia'
    : `${dias}d`;
  return <span className={clsx('selo', estilosSeguro[nivel])}>{texto}</span>;
}

const estilosStatus: Record<string, string> = {
  'Aberto': 'bg-sinal/12 text-sinal',
  'Em andamento': 'bg-ambar/15 text-ambar',
  'Concluído': 'bg-mata-fraco text-mata',
};

export function SeloStatus({ status }: { status: string }) {
  return <span className={clsx('selo', estilosStatus[status] ?? 'bg-concreto-200 text-grafite-600')}>{status}</span>;
}

const estilosPrioridade: Record<string, string> = {
  'Alta': 'bg-sinal/12 text-sinal',
  'Média': 'bg-ambar/15 text-ambar',
  'Baixa': 'bg-concreto-200 text-grafite-600',
};

export function SeloPrioridade({ prioridade }: { prioridade: string }) {
  return <span className={clsx('selo', estilosPrioridade[prioridade] ?? 'bg-concreto-200 text-grafite-600')}>{prioridade}</span>;
}

export function Placa({ valor }: { valor: string }) {
  const vazia = !valor || valor === '-';
  return (
    <span className={clsx(
      'dado inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wider',
      vazia ? 'border-concreto-300 text-grafite-600/50' : 'border-grafite-600/30 bg-concreto-100 text-grafite'
    )}>
      {vazia ? 'S/PLACA' : valor}
    </span>
  );
}
