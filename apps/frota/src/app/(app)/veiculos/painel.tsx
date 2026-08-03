'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, UserRoundCog, Gauge, Pencil, Plus } from 'lucide-react';
import type { Veiculo } from '@/db/schema';
import { salvarVeiculo, trocarMotorista, atualizarKm } from '@/app/acoes';

// ── modal base ────────────────────────────────────────────────────────────────
function Modal({
  aberto, aoFechar, titulo, children,
}: {
  aberto: boolean; aoFechar: () => void; titulo: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-barra/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-superficie sm:rounded-xl"
      >
        <div className="sticky top-0 border-b border-concreto-200 bg-superficie px-5 py-3.5">
          <h2 className="font-cond text-lg font-semibold uppercase tracking-wide text-grafite">
            {titulo}
          </h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── formulário de veículo ─────────────────────────────────────────────────────
function FormVeiculo({ veiculo, aoFechar }: { veiculo?: Veiculo; aoFechar: () => void }) {
  return (
    <form action={async (fd) => { await salvarVeiculo(fd); aoFechar(); }} className="space-y-3">
      {veiculo && <input type="hidden" name="id" value={veiculo.id} />}

      <div>
        <label className="rotulo-campo" htmlFor="nome">Modelo / descrição</label>
        <input id="nome" name="nome" required defaultValue={veiculo?.nome} className="campo" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo-campo" htmlFor="placa">Placa</label>
          <input id="placa" name="placa" defaultValue={veiculo?.placa} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="ano">Ano</label>
          <input id="ano" name="ano" inputMode="numeric" defaultValue={veiculo?.ano || ''} className="campo" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="rotulo-campo" htmlFor="motorista">Motorista</label>
          <input id="motorista" name="motorista" defaultValue={veiculo?.motorista} className="campo" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="renavam">Renavam</label>
          <input id="renavam" name="renavam" defaultValue={veiculo?.renavam} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="chassi">Chassi</label>
          <input id="chassi" name="chassi" defaultValue={veiculo?.chassi} className="campo" />
        </div>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="rotulo mb-1 text-grafite-600">Seguro</legend>
        <div>
          <label className="rotulo-campo" htmlFor="seguradora">Seguradora</label>
          <input id="seguradora" name="seguradora" defaultValue={veiculo?.seguradora} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="vencSeguro">Vencimento</label>
          <input id="vencSeguro" name="vencSeguro" type="date" defaultValue={veiculo?.vencSeguro} className="campo" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="rotulo-campo" htmlFor="valorSeguro">Valor (R$)</label>
          <input id="valorSeguro" name="valorSeguro" inputMode="decimal" defaultValue={veiculo?.valorSeguro || ''} className="campo" />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="rotulo mb-1 text-grafite-600">Quilometragem</legend>
        <div>
          <label className="rotulo-campo" htmlFor="kmRevisao">Última revisão</label>
          <input id="kmRevisao" name="kmRevisao" inputMode="numeric" defaultValue={veiculo?.kmRevisao || ''} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="kmAtual">Atual</label>
          <input id="kmAtual" name="kmAtual" inputMode="numeric" defaultValue={veiculo?.kmAtual || ''} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="kmProxima">Próxima</label>
          <input id="kmProxima" name="kmProxima" inputMode="numeric" defaultValue={veiculo?.kmProxima || ''} className="campo" />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="rotulo-campo" htmlFor="fipe">FIPE (R$)</label>
          <input id="fipe" name="fipe" inputMode="decimal" defaultValue={veiculo?.fipe || ''} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="codigoFipe">Código FIPE</label>
          <input id="codigoFipe" name="codigoFipe" placeholder="001004-9" defaultValue={veiculo?.codigoFipe} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="multas">Multas (R$)</label>
          <input id="multas" name="multas" inputMode="decimal" defaultValue={veiculo?.multas || ''} className="campo" />
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="taxas">Taxas (R$)</label>
          <input id="taxas" name="taxas" inputMode="decimal" defaultValue={veiculo?.taxas || ''} className="campo" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo-campo" htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={veiculo?.situacao ?? 'PAGO'} className="campo">
            <option>PAGO</option>
            <option>FINANCIADA</option>
            <option>CONSORCIO</option>
            <option>ALUGADO</option>
          </select>
        </div>
        <div>
          <label className="rotulo-campo" htmlFor="licenciamento">Licenciamento</label>
          <input id="licenciamento" name="licenciamento" defaultValue={veiculo?.licenciamento} className="campo" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={aoFechar} className="botao-fantasma">Cancelar</button>
        <button type="submit" className="botao-destaque">Salvar veículo</button>
      </div>
    </form>
  );
}

// ── menu por veículo ──────────────────────────────────────────────────────────
export function PainelVeiculo({ veiculo }: { veiculo: Veiculo }) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<null | 'editar' | 'motorista' | 'km'>(null);

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          onBlur={() => setTimeout(() => setMenu(false), 150)}
          aria-label={`Ações de ${veiculo.nome}`}
          aria-expanded={menu}
          className="rounded p-1.5 text-grafite-600 hover:bg-concreto-100 hover:text-grafite"
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>

        {menu && (
          <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-concreto-200 bg-superficie py-1 shadow-lg">
            <button
              type="button"
              onMouseDown={() => setModal('motorista')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100"
            >
              <UserRoundCog size={16} strokeWidth={1.75} /> Trocar motorista
            </button>
            <button
              type="button"
              onMouseDown={() => setModal('km')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100"
            >
              <Gauge size={16} strokeWidth={1.75} /> Atualizar km
            </button>
            <button
              type="button"
              onMouseDown={() => setModal('editar')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-grafite hover:bg-concreto-100"
            >
              <Pencil size={16} strokeWidth={1.75} /> Editar veículo
            </button>
          </div>
        )}
      </div>

      <Modal aberto={modal === 'editar'} aoFechar={() => setModal(null)} titulo="Editar veículo">
        <FormVeiculo veiculo={veiculo} aoFechar={() => setModal(null)} />
      </Modal>

      <Modal aberto={modal === 'motorista'} aoFechar={() => setModal(null)} titulo="Trocar motorista">
        <form action={async (fd) => { await trocarMotorista(fd); setModal(null); }} className="space-y-3">
          <input type="hidden" name="id" value={veiculo.id} />
          <p className="text-sm text-grafite-600">
            {veiculo.nome} — hoje com <strong className="text-grafite">{veiculo.motorista || 'ninguém'}</strong>
          </p>
          <div>
            <label className="rotulo-campo" htmlFor="motorista-novo">Novo motorista</label>
            <input id="motorista-novo" name="motorista" required defaultValue={veiculo.motorista} className="campo" />
          </div>
          <div>
            <label className="rotulo-campo" htmlFor="motivo">Motivo (opcional)</label>
            <input id="motivo" name="motivo" placeholder="Férias, transferência de obra…" className="campo" />
          </div>
          <p className="text-xs text-grafite-600/70">A troca fica registrada no histórico do veículo.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="botao-fantasma">Cancelar</button>
            <button type="submit" className="botao-destaque">Trocar</button>
          </div>
        </form>
      </Modal>

      <Modal aberto={modal === 'km'} aoFechar={() => setModal(null)} titulo="Atualizar quilometragem">
        <form action={async (fd) => { await atualizarKm(fd); setModal(null); }} className="space-y-3">
          <input type="hidden" name="id" value={veiculo.id} />
          <p className="text-sm text-grafite-600">{veiculo.nome}</p>
          <div>
            <label className="rotulo-campo" htmlFor="km-novo">Km no painel</label>
            <input
              id="km-novo" name="kmAtual" inputMode="numeric" required
              defaultValue={veiculo.kmAtual} className="campo dado text-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="botao-fantasma">Cancelar</button>
            <button type="submit" className="botao-destaque">Salvar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ── botão de novo veículo ─────────────────────────────────────────────────────
export function BotaoNovoVeiculo({ placas }: { placas: string[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="botao-destaque">
        <Plus size={16} strokeWidth={2} /> Novo veículo
      </button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo veículo">
        <FormVeiculo aoFechar={() => setAberto(false)} />
      </Modal>
    </>
  );
}

export { Modal };
