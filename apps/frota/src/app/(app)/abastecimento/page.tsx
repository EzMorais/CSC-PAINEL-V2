import { db, abastecimentos as tAbast, veiculos as tVeiculos, veiculosAutorizados as tAut } from '@/db';
import { Cabecalho } from '@/components/Casca';
import { Kpi } from '@/components/Kpi';
import { Placa } from '@/components/Selo';
import { brl, km, litros as fmtLitros, dataBr, indicadoresCombustivel } from '@/lib/frota';
import { PainelAbastecimento, BotaoNovoAbastecimento, BotaoImportar } from './painel';

export const dynamic = 'force-dynamic';

export default async function PaginaAbastecimento({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; combustivel?: string; aba?: string }>;
}) {
  const { q = '', combustivel = '', aba = 'lancamentos' } = await searchParams;

  const todos = db.select().from(tAbast).all();
  const veics = db.select().from(tVeiculos).all();
  const autorizados = db.select().from(tAut).all();
  const porPlaca = new Map(veics.map((v) => [v.placa, v]));

  const busca = q.trim().toLowerCase();
  const lista = todos
    .filter((a) => {
      const v = porPlaca.get(a.placa);
      const casaBusca = !busca
        || a.placa.toLowerCase().includes(busca)
        || a.posto.toLowerCase().includes(busca)
        || (v?.nome ?? '').toLowerCase().includes(busca);
      return casaBusca && (!combustivel || a.combustivel === combustivel);
    })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const ind = indicadoresCombustivel(todos);
  const combustiveis = [...new Set(todos.map((a) => a.combustivel).filter(Boolean))].sort();
  const placas = [...new Set([
    ...veics.map((v) => v.placa),
    ...autorizados.map((a) => a.placa),
  ].filter((p) => p && p !== '-'))].sort();

  const mapaCombustiveis = Object.fromEntries(autorizados.map((a) => [a.placa, a.combustiveis]));

  return (
    <>
      <Cabecalho
        titulo="Abastecimento"
        descricao={`${todos.length} lançamento${todos.length === 1 ? '' : 's'}`}
        acao={
          <div className="flex gap-2">
            <BotaoImportar />
            <BotaoNovoAbastecimento placas={placas} mapaCombustiveis={mapaCombustiveis} />
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Kpi rotulo="Total gasto" valor={brl(ind.totalGasto)} tom="perigo" />
          <Kpi rotulo="Litros" valor={fmtLitros(ind.totalLitros)} tom="destaque" />
          <Kpi rotulo="Custo médio" valor={brl(ind.custoMedio, 2)} tom="alerta" nota="por litro" />
          <Kpi rotulo="Autorizados" valor={String(autorizados.length)} nota="no posto" />
        </div>

        {/* sub-abas */}
        <div className="flex gap-1 border-b border-concreto-200">
          {[
            { chave: 'lancamentos', rotulo: 'Lançamentos' },
            { chave: 'autorizados', rotulo: 'Veículos autorizados' },
          ].map((t) => (
            <a
              key={t.chave}
              href={`/abastecimento?aba=${t.chave}`}
              className={
                aba === t.chave
                  ? 'rotulo -mb-px border-b-2 border-grafite px-3 py-2 text-grafite'
                  : 'rotulo -mb-px border-b-2 border-transparent px-3 py-2 text-grafite-600/60 hover:text-grafite'
              }
            >
              {t.rotulo}
            </a>
          ))}
        </div>

        {aba === 'autorizados' ? (
          autorizados.length === 0 ? (
            <div className="cartao px-4 py-12 text-center">
              <p className="text-sm text-grafite-600">
                Nenhum veículo autorizado ainda. Importe o CSV do posto para trazer o cadastro.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {autorizados.map((a) => (
                <li key={a.id} className="cartao p-3.5">
                  <div className="flex items-center gap-2">
                    <Placa valor={a.placa} />
                    <span className="selo bg-mata-fraco text-mata">{a.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-grafite">{a.modelo || '—'}</p>
                  <p className="text-xs text-grafite-600">
                    {a.fabricante}{a.ano ? ` · ${a.ano}` : ''} · {a.uf}
                  </p>
                  {a.combustiveis && (
                    <p className="mt-1.5 text-xs text-grafite-600">
                      <span className="rotulo">Autorizado: </span>{a.combustiveis}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <form className="flex flex-wrap items-end gap-2 sm:gap-3">
              <input type="hidden" name="aba" value="lancamentos" />
              <div className="min-w-0 flex-1 sm:max-w-xs">
                <label htmlFor="q" className="rotulo-campo">Buscar</label>
                <input id="q" name="q" defaultValue={q} className="campo" placeholder="Placa, veículo ou posto" />
              </div>
              <div className="w-full sm:w-44">
                <label htmlFor="combustivel" className="rotulo-campo">Combustível</label>
                <select id="combustivel" name="combustivel" defaultValue={combustivel} className="campo">
                  <option value="">Todos</option>
                  {combustiveis.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="botao-fantasma">Filtrar</button>
            </form>

            {lista.length === 0 ? (
              <div className="cartao px-4 py-12 text-center">
                <p className="text-sm text-grafite-600">
                  Sem lançamentos ainda. Importe o CSV do posto ou registre um abastecimento.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {lista.map((a) => {
                  const v = porPlaca.get(a.placa);
                  const porLitro = a.litros ? a.valorTotal / a.litros : 0;
                  return (
                    <li key={a.id} className="cartao flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Placa valor={a.placa} />
                          <span className="dado text-xs text-grafite-600">{dataBr(a.data)}</span>
                          {a.combustivel && (
                            <span className="selo bg-concreto-100 text-grafite-600">{a.combustivel}</span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-sm text-grafite">
                          {v?.nome ?? 'Veículo não cadastrado'}
                          {v?.motorista && <span className="text-grafite-600"> · {v.motorista}</span>}
                        </p>
                        <p className="dado mt-1 text-xs text-grafite-600">
                          {fmtLitros(a.litros)} · {brl(a.valorTotal, 2)}
                          {porLitro > 0 && ` · ${brl(porLitro, 2)}/L`}
                          {a.km > 0 && ` · ${km(a.km)} km`}
                          {a.posto && ` · ${a.posto}`}
                        </p>
                      </div>
                      <PainelAbastecimento
                        abastecimento={a}
                        placas={placas}
                        mapaCombustiveis={mapaCombustiveis}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
