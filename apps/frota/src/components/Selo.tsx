import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { NivelSeguro } from '@/lib/frota';

const base = 'selo';

const estilosSeguro: Record<NivelSeguro, string> = {
  vencido: 'border-sinal bg-sinal/10 text-sinal',
  critico: 'border-ambar bg-ambar/12 text-ambar',
  atencao: 'border-aco bg-aco-fraco text-aco',
  ok: 'border-mata bg-mata-fraco text-mata',
  sem: 'border-concreto-300 bg-concreto-100 text-grafite-600',
};

export function SeloSeguro({ nivel, dias }: { nivel: NivelSeguro; dias: number | null }) {
  const texto =
    nivel === 'sem' ? 'sem seguro'
    : nivel === 'vencido' ? `vencido ha ${Math.abs(dias!)}d`
    : nivel === 'ok' ? 'em dia'
    : `${dias}d`;
  return <span className={clsx(base, estilosSeguro[nivel])}>{texto}</span>;
}

const estilosStatus: Record<string, string> = {
  Aberto: 'border-sinal bg-sinal/10 text-sinal',
  'Em andamento': 'border-ambar bg-ambar/12 text-ambar',
  Concluido: 'border-mata bg-mata-fraco text-mata',
  'Concluído': 'border-mata bg-mata-fraco text-mata',
};

export function SeloStatus({ status }: { status: string }) {
  return <span className={clsx(base, estilosStatus[status] ?? 'border-concreto-300 bg-concreto-100 text-grafite-600')}>{status}</span>;
}

const estilosPrioridade: Record<string, string> = {
  Alta: 'border-sinal bg-sinal/10 text-sinal',
  Media: 'border-ambar bg-ambar/12 text-ambar',
  'Média': 'border-ambar bg-ambar/12 text-ambar',
  Baixa: 'border-concreto-300 bg-concreto-100 text-grafite-600',
};

export function SeloPrioridade({ prioridade }: { prioridade: string }) {
  return <span className={clsx(base, estilosPrioridade[prioridade] ?? 'border-concreto-300 bg-concreto-100 text-grafite-600')}>{prioridade}</span>;
}

export function CampoSelo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-grafite-600/70">
        {rotulo}
      </span>
      {children}
    </span>
  );
}

export function Placa({ valor }: { valor: string }) {
  const vazia = !valor || valor === '-';
  return (
    <span
      className={clsx(
        'dado inline-block rounded-sm border-2 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider',
        vazia ? 'border-concreto-300 bg-concreto-100 text-grafite-600/50' : 'border-grafite-600/30 bg-concreto-100 text-grafite'
      )}
    >
      {vazia ? 'S/PLACA' : valor}
    </span>
  );
}
