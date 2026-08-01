'use client';

import { useState } from 'react';
import { MoreVertical, Pencil, CheckCircle2, Loader, FolderOpen, Paperclip, Trash2, Plus } from 'lucide-react';
import type { Manutencao } from '@/db/schema';
import { Modal } from '../veiculos/painel';
import {
  salvarManutencao, mudarStatusManutencao, removerManutencao, anexarFoto,
} from '@/app/acoes';
import { hoje } from '@/lib/frota';

function FormManutencao({
  manutencao, placas, aoFechar,
}: {
  manutencao?: Manutencao; placas: string[]; aoFechar: () => void;
}) {
  return (
    <form action={async (fd) => { await salvarManutencao(fd); aoFechar(); }} className="space-y-3">
      {manutencao && <input type="hidden" name="id" value={manutencao.id} />}

      <div>
        <label className="rotulo-campo" htmlFor="placa">Veículo</label>
        <select id="placa" name="placa" defaultValue={manutencao?.placa} required className="campo">
          <option value="">Escolha a placa</option>
          {placas.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label className="rotulo-campo" htmlFor="problema">O que está acontecendo</label>
        <textarea
          id="problema" name="problema" required rows={3}
          defaultValue={manutencao?.problema} className="campo"
          placeholder="Descreva o problema como o motorista relatou"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo-campo" htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={manutencao?.categoria ?? 'Mecânica'} className="campo">
            <option>Mecânica</option>
            <option>Elétrica</option>
            <option>Carroceria</option>
            <option>Pneus/Suspensão</option>
            <option>Outro</option>
          </select>
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="prioridade">Prioridade</label>
          <select id="prioridade" name="prioridade" defaultValue={manutencao?.prioridade ?? 'Média'} className="campo">
            <option>Alta</option>
            <option>Média</option>
            <option>Baixa</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="rotulo-campo" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={manutencao?.status ?? 'Aberto'} className="campo">
            <option>Aberto</option>
            <option>Em andamento</option>
            <option>Concluído</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="dataIdentificacao">Identificado em</label>
          <input
            id="dataIdentificacao" name="dataIdentificacao" type="date"
            defaultValue={manutencao?.dataIdentificacao || hoje()} className="campo"
          />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="previsaoSolucao">Previsão</label>
          <input
            id="previsaoSolucao" name="previsaoSolucao" type="date"
            defaultValue={manutencao?.previsaoSolucao} className="campo"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="oficina">Oficina / responsável</label>
          <input id="oficina" name="oficina" defaultValue={manutencao?.oficina} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="custo">Custo (R$)</label>
          <input id="custo" name="custo" inputMode="decimal" defaultValue={manutencao?.custo || ''} className="campo" />
        </div>
      </div>

      <div>
        <label className="rotulo-campo" htmlFor="obs">Observações</label>
        <input id="obs" name="obs" defaultValue={manutencao?.obs} className="campo" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={aoFechar} className="botao-fantasma">Cancelar</button>
        <button type="submit" className="botao-destaque">Salvar</button>
      </div>
    </form>
  );
}

export function PainelManutencao({ manutencao, placas }: { manutencao: Manutencao; placas: string[] }) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<null | 'editar' | 'anexo'>(null);

  const mudar = async (status: string) => {
    const fd = new FormData();
    fd.set('id', String(manutencao.id));
    fd.set('status', status);
    await mudarStatusManutencao(fd);
  };

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          onBlur={() => setTimeout(() => setMenu(false), 150)}
          aria-label="Ações do registro"
          aria-expanded={menu}
          className="rounded p-1.5 text-grafite-600 hover:bg-concreto-100 hover:text-grafite"
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>

        {menu && (
          <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-concreto-200 bg-white py-1 shadow-lg">
            {manutencao.status !== 'Concluído' && (
              <button type="button" onMouseDown={() => mudar('Concluído')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
                <CheckCircle2 size={16} strokeWidth={1.75} /> Marcar concluído
              </button>
            )}
            {manutencao.status !== 'Em andamento' && (
              <button type="button" onMouseDown={() => mudar('Em andamento')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
                <Loader size={16} strokeWidth={1.75} /> Em andamento
              </button>
            )}
            {manutencao.status !== 'Aberto' && (
              <button type="button" onMouseDown={() => mudar('Aberto')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
                <FolderOpen size={16} strokeWidth={1.75} /> Reabrir
              </button>
            )}
            <button type="button" onMouseDown={() => setModal('anexo')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
              <Paperclip size={16} strokeWidth={1.75} /> Anexar foto
            </button>
            <button type="button" onMouseDown={() => setModal('editar')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100">
              <Pencil size={16} strokeWidth={1.75} /> Editar
            </button>
            <form action={removerManutencao}>
              <input type="hidden" name="id" value={manutencao.id} />
              <button type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-sinal hover:bg-sinal-fraco">
                <Trash2 size={16} strokeWidth={1.75} /> Remover
              </button>
            </form>
          </div>
        )}
      </div>

      <Modal aberto={modal === 'editar'} aoFechar={() => setModal(null)} titulo="Editar registro">
        <FormManutencao manutencao={manutencao} placas={placas} aoFechar={() => setModal(null)} />
      </Modal>

      <Modal aberto={modal === 'anexo'} aoFechar={() => setModal(null)} titulo="Anexar foto ou orçamento">
        <form action={async (fd) => { await anexarFoto(fd); setModal(null); }} className="space-y-3">
          <input type="hidden" name="manutencaoId" value={manutencao.id} />
          <div>
            <label className="rotulo-campo" htmlFor="arquivo">Arquivo</label>
            <input
              id="arquivo" name="arquivo" type="file" required
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              className="campo file:mr-3 file:rounded file:border-0 file:bg-concreto-200 file:px-3 file:py-1 file:text-sm"
            />
          </div>
          <p className="text-xs text-grafite-600/70">
            Foto do problema ou PDF do orçamento. Até 8 MB.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="botao-fantasma">Cancelar</button>
            <button type="submit" className="botao-destaque">Anexar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function BotaoNovoProblema({ placas }: { placas: string[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="botao-destaque">
        <Plus size={16} strokeWidth={2} /> Registrar problema
      </button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Registrar problema">
        <FormManutencao placas={placas} aoFechar={() => setAberto(false)} />
      </Modal>
    </>
  );
}
