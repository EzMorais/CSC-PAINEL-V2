import { db, veiculos as tVeiculos, manutencoes as tManut } from '@/db';
import { Cabecalho } from '@/components/Casca';
import { Kpi } from '@/components/Kpi';
import { Hodometro } from '@/components/Hodometro';
import { SeloSeguro, Placa } from '@/components/Selo';
import { brl, km, dataBr, nivelSeguro, estadoRevisao } from '@/lib/frota';
import { PainelVeiculo, BotaoNovoVeiculo } from './painel';

export const dynamic = 'force-dynamic';

export default async function PaginaVeiculos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; situacao?: string }>;
}) {
  const { q = '', situacao = '' } = await searchParams;
  const todos = db.select().from(tVeiculos).all();
  const manuts = db.select().from(tManut).all();

  const busca = q.trim().toLowerCase();
  const lista = todos.filter((v) => {
    const casaBusca =
      !busca ||
      v.nome.toLowerCase().includes(busca) ||
      v.placa.toLowerCase().includes(busca) ||
      v.motorista.toLowerCase().includes(busca);
    const casaSituacao = !situacao || v.situacao === situacao;
    return casaBusca && casaSituacao;
  });

  const segCriticos = todos.filter((v) => {
    const n = nivelSeguro(v).nivel;
    return n === 'vencido' || n === 'critico';
  }).length;
  const revVencidas = todos.filter((v) => estadoRevisao(v).nivel === 'vencida').length;
  const abertos = manuts.filter((m) => m.status === 'Aberto').length;
  const valorFrota = todos.reduce((s, v) => s + v.fipe, 0);

  const placas = todos.map((v) => v.placa).filter((p) => p && p !== '-');

  return (
    <>
      <Cabecalho
        titulo="Veículos"
        descricao={`${todos.length} na frota`}
        acao={<BotaoNovoVeiculo placas={placas} />}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Kpi rotulo="Na frota" valor={String(todos.length)} />
          <Kpi
            rotulo="Seguro crítico"
            valor={String(segCriticos)}
            tom={segCriticos ? 'perigo' : 'bom'}
            nota="vencido ou ≤30 dias"
          />
          <Kpi
            rotulo="Revisão vencida"
            valor={String(revVencidas)}
            tom={revVencidas ? 'alerta' : 'bom'}
          />
          <Kpi rotulo="Valor FIPE" valor={brl(valorFrota)} tom="destaque" nota={`${abertos} problemas abertos`} />
        </div>

        {/* filtros */}
        <form className="flex flex-wrap items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="q" className="rotulo-campo">Buscar</label>
            <input
              id="q" name="q" defaultValue={q} className="campo"
              placeholder="Modelo, placa ou motorista"
            />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="situacao" className="rotulo-campo">Situação</label>
            <select id="situacao" name="situacao" defaultValue={situacao} className="campo">
              <option value="">Todas</option>
              <option>PAGO</option>
              <option>FINANCIADA</option>
              <option>CONSORCIO</option>
              <option>ALUGADO</option>
            </select>
          </div>
          <button type="submit" className="botao-fantasma">Filtrar</button>
        </form>

        {lista.length === 0 ? (
          <div className="cartao px-4 py-12 text-center">
            <p className="text-sm text-grafite-600">
              Nenhum veículo com esses filtros. Ajuste a busca ou cadastre um novo.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {lista.map((v) => {
              const seg = nivelSeguro(v);
              const problemasAbertos = manuts.filter(
                (m) => m.placa === v.placa && m.status !== 'Concluído'
              ).length;

              return (
                <li key={v.id} className="cartao flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-cond text-base font-semibold uppercase leading-tight tracking-wide text-grafite">
                        {v.nome}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Placa valor={v.placa} />
                        <span className="selo bg-concreto-100 text-grafite-600">{v.situacao}</span>
                        {problemasAbertos > 0 && (
                          <span className="selo bg-sinal/10 text-sinal">
                            {problemasAbertos} problema{problemasAbertos > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <PainelVeiculo veiculo={v} />
                  </div>

                  <Hodometro
                    kmRevisao={v.kmRevisao}
                    kmAtual={v.kmAtual}
                    kmProxima={v.kmProxima}
                  />

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-concreto-200 pt-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="rotulo text-grafite-600">Motorista</dt>
                      <dd className="truncate text-grafite">{v.motorista || '—'}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-grafite-600">Km atual</dt>
                      <dd className="dado text-grafite">{km(v.kmAtual)}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-grafite-600">Seguro</dt>
                      <dd className="flex items-center gap-1.5">
                        <SeloSeguro nivel={seg.nivel} dias={seg.dias} />
                      </dd>
                    </div>
                    <div>
                      <dt className="rotulo text-grafite-600">Vencimento</dt>
                      <dd className="dado text-grafite">{dataBr(v.vencSeguro)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
