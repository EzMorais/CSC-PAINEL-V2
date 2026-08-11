'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Truck, Wrench, Fuel, Bell, LogOut, FileDown } from 'lucide-react';
import { BotaoTema } from '@/components/Tema';

const itens = [
  { href: '/veiculos', rotulo: 'Veiculos', Icone: Truck },
  { href: '/manutencoes', rotulo: 'Manutencoes', Icone: Wrench },
  { href: '/abastecimento', rotulo: 'Abastecimento', Icone: Fuel },
  { href: '/alertas', rotulo: 'Alertas', Icone: Bell },
];

export function Casca({
  usuario,
  children,
}: {
  usuario: { nome: string; papel: string };
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-concreto text-grafite">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-black/20 bg-barra lg:flex">
        <div className="border-b-2 border-barra-700 px-5 py-5">
          <div className="flex items-baseline gap-2">
            <span className="h-3 w-3 rounded-sm bg-hivis shadow-[3px_3px_0_rgb(18_22_28_/_0.45)]" aria-hidden />
            <span className="rotulo text-sm text-barra-texto">Frota</span>
          </div>
          <p className="mt-1 text-[11px] leading-tight text-barra-suave/65">
            Construtora Siqueira Campos
          </p>
        </div>

        <nav className="flex-1 py-3">
          {itens.map(({ href, rotulo, Icone }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'relative flex items-center gap-3 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition-colors',
                ativo(href)
                  ? 'border-l-4 border-hivis bg-barra-800 text-barra-texto'
                  : 'text-barra-suave/60 hover:bg-barra-800/50 hover:text-barra-texto'
              )}
            >
              <Icone size={17} strokeWidth={1.75} />
              {rotulo}
            </Link>
          ))}
        </nav>

        <div className="border-t-2 border-barra-700 p-3">
          <a
            href="/api/exportar"
            className="mb-2 flex items-center gap-2 rounded-sm border-2 border-barra-700 bg-barra-800 px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-barra-texto hover:bg-barra-700"
          >
            <FileDown size={16} strokeWidth={1.75} />
            Planilha do chefe
          </a>
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="truncate text-xs text-barra-texto">{usuario.nome}</p>
              <p className="rotulo text-[10px] text-barra-suave/60">{usuario.papel}</p>
            </div>
            <div className="flex items-center gap-1">
              <BotaoTema className="size-8 border-2 border-barra-700 text-barra-suave/70 hover:bg-barra-700 hover:text-barra-texto" />
              <form action="/api/sair" method="post">
                <button
                  type="submit"
                  aria-label="Sair"
                  className="rounded-sm border-2 border-barra-700 p-1.5 text-barra-suave/60 hover:bg-barra-700 hover:text-barra-texto"
                >
                  <LogOut size={16} strokeWidth={1.75} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-black/20 bg-barra px-4 py-3 lg:hidden">
        <div className="flex items-baseline gap-2">
          <span className="h-3 w-3 rounded-sm bg-hivis shadow-[3px_3px_0_rgb(18_22_28_/_0.45)]" aria-hidden />
          <span className="rotulo text-sm text-barra-texto">Frota</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/api/exportar"
            aria-label="Baixar planilha"
            className="rounded-sm border-2 border-barra-700 p-2 text-barra-texto hover:bg-barra-700"
          >
            <FileDown size={18} strokeWidth={1.75} />
          </a>
          <BotaoTema className="size-9 border-2 border-barra-700 text-barra-texto hover:bg-barra-700" />
          <form action="/api/sair" method="post">
            <button
              type="submit"
              aria-label="Sair"
              className="rounded-sm border-2 border-barra-700 p-2 text-barra-texto hover:bg-barra-700"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </header>

      <main className="pb-20 lg:ml-60 lg:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t-2 border-black/15 bg-superficie lg:hidden">
        {itens.map(({ href, rotulo, Icone }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
              ativo(href) ? 'text-grafite' : 'text-grafite-600/50'
            )}
          >
            <span className="relative">
              {ativo(href) && (
                <span
                  className="absolute -top-2.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-hivis shadow-[3px_3px_0_rgb(18_22_28_/_0.3)]"
                  aria-hidden
                />
              )}
              <Icone size={20} strokeWidth={ativo(href) ? 2 : 1.6} />
            </span>
            <span className="rotulo">{rotulo}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Cabecalho({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-black/10 bg-superficie px-4 py-4 sm:px-6">
      <div>
        <h1 className="font-cond text-2xl font-semibold uppercase tracking-[0.12em] text-grafite">
          {titulo}
        </h1>
        {descricao && <p className="mt-0.5 text-sm text-grafite-600">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
