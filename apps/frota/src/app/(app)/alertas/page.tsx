import clsx from 'clsx';
import { ShieldAlert, Gauge, Receipt, Wrench } from 'lucide-react';
import { db, veiculos as tVeiculos, manutencoes as tManut } from '@/db';
import { Cabecalho } from '@/components/Casca';
import { montarAlertas, type Alerta } from '@/lib/frota';

export const dynamic = 'force-dynamic';

const icones = {
  seguro: ShieldAlert,
  revisao: Gauge,
  multa: Receipt,
  manutencao: Wrench,
} as const;

const rotulos = {
  seguro: 'Seguro',
  revisao: 'Revisão',
  multa: 'Multa',
  manutencao: 'Manutenção',
} as const;

function Cartao({ alerta }: { alerta: Alerta }) {
  const Icone = icones[alerta.tipo];
  const alta = alerta.gravidade === 'alta';

  return (
    <li
      className={clsx(
        'cartao flex gap-3 border-l-[3px] p-4',
        alta ? 'border-l-sinal' : 'border-l-ambar'
      )}
    >
      <span
        className={clsx(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          alta ? 'bg-sinal/10 text-sinal' : 'bg-ambar/10 text-ambar'
        )}
      >
        <Icone size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rotulo text-grafite-600">{rotulos[alerta.tipo]}</span>
          {alta && <span className="selo bg-sinal/10 text-sinal">urgente</span>}
        </div>
        <p className="mt-0.5 text-sm font-medium leading-snug text-grafite">{alerta.titulo}</p>
        <p className="mt-0.5 text-xs text-grafite-600">{alerta.detalhe}</p>
      </div>
    </li>
  );
}

export default async function PaginaAlertas() {
  const vs = db.select().from(tVeiculos).all();
  const ms = db.select().from(tManut).all();
  const alertas = montarAlertas(vs, ms);

  const urgentes = alertas.filter((a) => a.gravidade === 'alta');
  const atencao = alertas.filter((a) => a.gravidade === 'media');

  return (
    <>
      <Cabecalho
        titulo="Alertas"
        descricao={
          alertas.length === 0
            ? 'Nada exigindo ação agora'
            : `${urgentes.length} urgente${urgentes.length === 1 ? '' : 's'} · ${atencao.length} para acompanhar`
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {alertas.length === 0 ? (
          <div className="cartao px-4 py-16 text-center">
            <p className="font-cond text-xl uppercase tracking-wide text-mata">Frota em dia</p>
            <p className="mt-1 text-sm text-grafite-600">
              Sem seguro vencendo, revisão atrasada ou multa em aberto.
            </p>
          </div>
        ) : (
          <>
            {urgentes.length > 0 && (
              <section>
                <h2 className="rotulo mb-2 text-sinal">Resolver agora</h2>
                <ul className="space-y-2.5">
                  {urgentes.map((a, i) => <Cartao key={`u${i}`} alerta={a} />)}
                </ul>
              </section>
            )}

            {atencao.length > 0 && (
              <section>
                <h2 className="rotulo mb-2 text-ambar">Acompanhar</h2>
                <ul className="space-y-2.5">
                  {atencao.map((a, i) => <Cartao key={`a${i}`} alerta={a} />)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
