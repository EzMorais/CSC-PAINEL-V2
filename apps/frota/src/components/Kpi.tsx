import clsx from 'clsx';

type Props = {
  rotulo: string;
  valor: string;
  tom?: 'neutro' | 'perigo' | 'alerta' | 'bom' | 'destaque';
  nota?: string;
};

const tons = {
  neutro: 'text-grafite',
  perigo: 'text-sinal',
  alerta: 'text-ambar',
  bom: 'text-mata',
  destaque: 'text-aco',
};

export function Kpi({ rotulo, valor, tom = 'neutro', nota }: Props) {
  return (
    <div className="cartao px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="rotulo border-b border-concreto-300 pb-1 text-grafite-600">{rotulo}</div>
      <div className={clsx('dado mt-2 text-xl font-semibold leading-none sm:text-2xl', tons[tom])}>
        {valor}
      </div>
      {nota && <div className="mt-1.5 text-[11px] text-grafite-600/70">{nota}</div>}
    </div>
  );
}
