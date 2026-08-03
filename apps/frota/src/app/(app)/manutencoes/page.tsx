import { db, manutencoes as tManut, veiculos as tVeiculos, anexos as tAnexos } from '@/db';
import { Cabecalho } from '@/components/Casca';
import { Kpi } from '@/components/Kpi';
import { SeloStatus, SeloPrioridade, Placa, CampoSelo } from '@/components/Selo';
import { dataBr, brl, diasAteVencer } from '@/lib/frota';
import { PainelManutencao, BotaoNovoProblema } from './painel';

export const dynamic = 'force-dynamic';

export default async function PaginaManutencoes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; placa?: string }>;
}) {
  const { q = '', status = '', placa = '' } = await searchParams;

  const todas = db.select().from(tManut).all();
  const veics = db.select().from(tVeiculos).all();
  const todosAnexos = db.select().from(tAnexos).all();

  const porVeiculo = new Map(veics.map((v) => [v.placa, v]));
  const busca = q.trim().toLowerCase();

  const lista = todas
    .filter((m) => {
      const casaBusca = !busca || m.placa.toLowerCase().includes(busca) || m.problema.toLowerCase().includes(busca);
      return casaBusca && (!status || m.status === status) && (!placa || m.placa === placa);
    })
    .sort((a, b) => String(b.dataIdentificacao).localeCompare(String(a.dataIdentificacao)));

  const abertos = todas.filter((m) => m.status === 'Aberto').length;
  const andamento = todas.filter((m) => m.status === 'Em andamento').length;
  const concluidos = todas.filter((m) => m.status === 'Concluído').length;
  const custoTotal = todas.reduce((s, m) => s + m.custo, 0);

  const placas = [...new Set(veics.map((v) => v.placa).filter((p) => p && p !== '-'))].sort();

  return (
    <>
      <Cabecalho
        titulo="Manutenções"
        descricao={`${abertos} aberto${abertos === 1 ? '' : 's'} · ${andamento} em andamento`}
        acao={<BotaoNovoProblema placas={placas} />}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Kpi rotulo="Abertos" valor={String(abertos)} tom={abertos ? 'perigo' : 'bom'} />
          <Kpi rotulo="Em andamento" valor={String(andamento)} tom="alerta" />
          <Kpi rotulo="Concluídos" valor={String(concluidos)} tom="bom" />
          <Kpi rotulo="Custo lançado" valor={brl(custoTotal)} tom="destaque" />
        </div>

        <form className="flex flex-wrap items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="q" className="rotulo-campo">Buscar</label>
            <input id="q" name="q" defaultValue={q} className="campo" placeholder="Placa ou problema" />
          </div>
          <div className="w-[calc(50%-0.25rem)] sm:w-40">
            <label htmlFor="status" className="rotulo-campo">Status</label>
            <select id="status" name="status" defaultValue={status} className="campo">
              <option value="">Todos</option>
              <option>Aberto</option>
              <option>Em andamento</option>
              <option>Concluído</option>
            </select>
          </div>
          <div className="w-[calc(50%-0.25rem)] sm:w-36">
            <label htmlFor="placa" className="rotulo-campo">Placa</label>
            <select id="placa" name="placa" defaultValue={placa} className="campo">
              <option value="">Todas</option>
              {placas.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="botao-fantasma">Filtrar</button>
        </form>

        {lista.length === 0 ? (
          <div className="cartao px-4 py-12 text-center">
            <p className="text-sm text-grafite-600">
              Nada por aqui com esses filtros. Registre um problema para começar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((m) => {
              const v = porVeiculo.get(m.placa);
              const dias = diasAteVencer(m.dataIdentificacao);
              const idade = dias === null ? null : Math.abs(dias);
              const meusAnexos = todosAnexos.filter((a) => a.manutencaoId === m.id);

              return (
                <li key={m.id} className="cartao p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                        <CampoSelo rotulo="Placa">
                          <Placa valor={m.placa} />
                        </CampoSelo>
                        <CampoSelo rotulo="Situação">
                          <SeloStatus status={m.status} />
                        </CampoSelo>
                        <CampoSelo rotulo="Prioridade">
                          <SeloPrioridade prioridade={m.prioridade} />
                        </CampoSelo>
                        <CampoSelo rotulo="Tipo de ocorrência">
                          <span className="selo bg-concreto-100 text-grafite-600">{m.categoria}</span>
                        </CampoSelo>
                      </div>

                      <p className="mt-2 text-sm font-medium leading-snug text-grafite">{m.problema}</p>

                      <p className="mt-1 text-xs text-grafite-600">
                        {v?.nome ?? 'Veículo não vinculado'}
                        {idade !== null && m.status !== 'Concluído' && ` · aberto há ${idade} dias`}
                        {m.oficina && ` · ${m.oficina}`}
                        {m.custo > 0 && ` · ${brl(m.custo, 2)}`}
                        {m.previsaoSolucao && ` · previsão ${dataBr(m.previsaoSolucao)}`}
                      </p>

                      {meusAnexos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {meusAnexos.map((a) => (
                            <a
                              key={a.id}
                              href={a.caminho}
                              target="_blank"
                              rel="noreferrer"
                              className="selo bg-aco-fraco text-aco hover:underline"
                            >
                              {a.nomeArquivo.slice(0, 28)}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <PainelManutencao manutencao={m} placas={placas} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
