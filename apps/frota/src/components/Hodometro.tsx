import clsx from 'clsx';
import { km as fmtKm } from '@/lib/frota';

type Props = {
  kmRevisao: number;
  kmAtual: number;
  kmProxima: number;
  compacto?: boolean;
};

export function Hodometro({ kmRevisao, kmAtual, kmProxima, compacto }: Props) {
  if (!kmProxima) {
    return <span className="dado text-xs text-grafite-600/60">sem revisao programada</span>;
  }

  const intervalo = kmProxima - kmRevisao;
  const restante = kmProxima - kmAtual;
  const pct = intervalo > 0 ? Math.min(100, Math.max(0, ((kmAtual - kmRevisao) / intervalo) * 100)) : 100;

  const vencida = restante <= 0;
  const proxima = !vencida && restante <= 2000;

  const corTrilho = vencida ? 'bg-sinal/25' : proxima ? 'bg-ambar/25' : 'bg-concreto-200';
  const corBarra = vencida ? 'bg-sinal' : proxima ? 'bg-ambar' : 'bg-barra-700';

  return (
    <div className={clsx('w-full', compacto ? 'space-y-1' : 'space-y-1.5')}>
      <div className={clsx('relative h-2 w-full rounded-sm border border-black/10', corTrilho)}>
        <div
          className={clsx('h-full rounded-sm transition-[width] duration-500', corBarra)}
          style={{ width: `${pct}%` }}
        />
        <div
          className={clsx(
            'absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full',
            vencida ? 'bg-sinal' : proxima ? 'bg-ambar' : 'bg-barra'
          )}
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="dado text-[11px] text-grafite-600">
          {fmtKm(kmRevisao)} <span className="text-grafite-600/40">→</span> {fmtKm(kmProxima)}
        </span>
        <span
          className={clsx(
            'dado text-[11px] font-semibold uppercase tracking-[0.08em]',
            vencida ? 'text-sinal' : proxima ? 'text-ambar' : 'text-grafite-700'
          )}
        >
          {vencida ? `${fmtKm(Math.abs(restante))} km vencida` : `faltam ${fmtKm(restante)} km`}
        </span>
      </div>
    </div>
  );
}
