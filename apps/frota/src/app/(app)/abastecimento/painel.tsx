'use client';

import { useState, useActionState } from 'react';
import { MoreVertical, Pencil, Trash2, Plus, Upload } from 'lucide-react';
import type { Abastecimento } from '@/db/schema';
import { Modal } from '../veiculos/painel';
import { salvarAbastecimento, removerAbastecimento, importarCsvPosto } from '@/app/acoes';
import { hoje } from '@/lib/frota';

const PADRAO = ['Gasolina', 'Gasolina Aditivada', 'Etanol', 'Diesel', 'Diesel S10', 'GNV'];

function FormAbastecimento({
  abastecimento, placas, mapaCombustiveis, aoFechar,
}: {
  abastecimento?: Abastecimento;
  placas: string[];
  mapaCombustiveis: Record<string, string>;
  aoFechar: () => void;
}) {
  const [placa, setPlaca] = useState(abastecimento?.placa ?? '');

  const autorizados = (mapaCombustiveis[placa] ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const opcoes = autorizados.length ? autorizados : PADRAO;

  return (
    <form action={async (fd) => { await salvarAbastecimento(fd); aoFechar(); }} className="space-y-3">
      {abastecimento && <input type="hidden" name="id" value={abastecimento.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="placa">Placa</label>
          <select
            id="placa" name="placa" required value={placa}
            onChange={(e) => setPlaca(e.target.value)} className="campo"
          >
            <option value="">Escolha</option>
            {placas.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="data">Data</label>
          <input
            id="data" name="data" type="date" required
            defaultValue={abastecimento?.data || hoje()} className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo-campo" htmlFor="combustivel">Combustível</label>
        <select
          id="combustivel" name="combustivel"
          defaultValue={abastecimento?.combustivel} className="campo"
        >
          {opcoes.map((c) => <option key={c}>{c}</option>)}
        </select>
        {autorizados.length > 0 && (
          <p className="mt-1 text-xs text-grafite-600/70">
            Combustíveis autorizados no posto para esta placa.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo-campo" htmlFor="litros">Litros</label>
          <input
            id="litros" name="litros" inputMode="decimal" required
            defaultValue={abastecimento?.litros || ''} className="campo dado"
          />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="valorTotal">Valor (R$)</label>
          <input
            id="valorTotal" name="valorTotal" inputMode="decimal" required
            defaultValue={abastecimento?.valorTotal || ''} className="campo dado"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="rotulo-campo" htmlFor="km">Km no painel</label>
          <input
            id="km" name="km" inputMode="numeric"
            defaultValue={abastecimento?.km || ''} className="campo dado"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="posto">Posto</label>
          <input id="posto" name="posto" defaultValue={abastecimento?.posto} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="obs">Observações</label>
          <input id="obs" name="obs" defaultValue={abastecimento?.obs} className="campo" />
        </div>
      </div>

      <p className="text-xs text-grafite-600/70">
        O km informado aqui também atualiza a quilometragem do veículo, se for maior que a atual.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={aoFechar} className="botao-fantasma">Cancelar</button>
        <button type="submit" className="botao-destaque">Salvar</button>
      </div>
    </form>
  );
}

export function PainelAbastecimento({
  abastecimento, placas, mapaCombustiveis,
}: {
  abastecimento: Abastecimento;
  placas: string[];
  mapaCombustiveis: Record<string, string>;
}) {
  const [menu, setMenu] = useState(false);
  const [editar, setEditar] = useState(false);

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          onBlur={() => setTimeout(() => setMenu(false), 150)}
          aria-label="Ações do lançamento"
          aria-expanded={menu}
          className="rounded p-1.5 text-grafite-600 hover:bg-concreto-100 hover:text-grafite"
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>

        {menu && (
          <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-concreto-200 bg-white py-1 shadow-lg">
            <button type="button" onMouseDown={() => setEditar(true)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
              <Pencil size={16} strokeWidth={1.75} /> Editar
            </button>
            <form action={removerAbastecimento}>
              <input type="hidden" name="id" value={abastecimento.id} />
              <button type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-sinal hover:bg-sinal-fraco">
                <Trash2 size={16} strokeWidth={1.75} /> Remover
              </button>
            </form>
          </div>
        )}
      </div>

      <Modal aberto={editar} aoFechar={() => setEditar(false)} titulo="Editar abastecimento">
        <FormAbastecimento
          abastecimento={abastecimento} placas={placas}
          mapaCombustiveis={mapaCombustiveis} aoFechar={() => setEditar(false)}
        />
      </Modal>
    </>
  );
}

export function BotaoNovoAbastecimento({
  placas, mapaCombustiveis,
}: {
  placas: string[]; mapaCombustiveis: Record<string, string>;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="botao-destaque">
        <Plus size={16} strokeWidth={2} />
        <span className="hidden sm:inline">Abastecimento</span>
      </button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo abastecimento">
        <FormAbastecimento
          placas={placas} mapaCombustiveis={mapaCombustiveis}
          aoFechar={() => setAberto(false)}
        />
      </Modal>
    </>
  );
}

type Resultado = {
  ok?: boolean; erro?: string; autorizados?: number;
  lancamentos?: number; colunas?: string[]; aviso?: string;
} | null;

export function BotaoImportar() {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState(importarCsvPosto, null as Resultado);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="botao-fantasma">
        <Upload size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">Importar CSV</span>
      </button>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Importar CSV do posto">
        <form action={acao} className="space-y-3">
          <div>
            <label className="rotulo-campo" htmlFor="arquivo">Arquivo exportado pelo posto</label>
            <input
              id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required
              className="campo file:mr-3 file:rounded file:border-0 file:bg-concreto-200 file:px-3 file:py-1 file:text-sm"
            />
          </div>

          <p className="text-xs text-grafite-600/70">
            O cadastro de veículos autorizados é atualizado pela placa. Se o arquivo trouxer
            colunas de litros ou valor, os abastecimentos entram como novos lançamentos.
          </p>

          {estado?.erro && (
            <p role="alert" className="rounded-md bg-sinal-fraco px-3 py-2 text-sm text-sinal">
              {estado.erro}
            </p>
          )}

          {estado?.ok && (
            <div className="space-y-1.5 rounded-md bg-mata-fraco px-3 py-2.5 text-sm text-mata">
              <p className="font-medium">
                {estado.autorizados} veículo(s) autorizado(s) · {estado.lancamentos} lançamento(s)
              </p>
              {estado.aviso && <p className="text-xs">{estado.aviso}</p>}
              {estado.colunas && (
                <p className="text-xs opacity-80">
                  Colunas lidas: {estado.colunas.join(', ')}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAberto(false)} className="botao-fantasma">
              Fechar
            </button>
            <button type="submit" disabled={pendente} className="botao-destaque">
              {pendente ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
