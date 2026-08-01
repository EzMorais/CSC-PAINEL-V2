'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Truck, Wrench, Fuel, Bell, LogOut, FileDown } from 'lucide-react';

const itens = [
  { href: '/veiculos', rotulo: 'Veículos', Icone: Truck },
  { href: '/manutencoes', rotulo: 'Manutenções', Icone: Wrench },
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
    <div className="min-h-dvh bg-concreto">
      {/* ── trilho lateral (desktop) ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-grafite lg:flex">
        <div className="border-b border-grafite-700 px-5 py-5">
          <div className="flex items-baseline gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-hivis" aria-hidden />
            <span className="rotulo text-sm text-concreto">Frota</span>
          </div>
          <p className="mt-1 text-[11px] leading-tight text-concreto-300/60">
            Construtora Siqueira Campos
          </p>
        </div>

        <nav className="flex-1 py-3">
          {itens.map(({ href, rotulo, Icone }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'relative flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                ativo(href)
                  ? 'bg-grafite-800 text-concreto'
                  : 'text-concreto-300/60 hover:bg-grafite-800/50 hover:text-concreto-200'
              )}
            >
              {ativo(href) && (
                <span className="absolute inset-y-0 left-0 w-[3px] bg-hivis" aria-hidden />
              )}
              <Icone size={17} strokeWidth={1.75} />
              {rotulo}
            </Link>
          ))}
        </nav>

        <div className="border-t border-grafite-700 p-3">
          <a
            href="/api/exportar"
            className="mb-2 flex items-center gap-2 rounded-md bg-grafite-800 px-3 py-2 text-sm text-concreto-200 hover:bg-grafite-700"
          >
            <FileDown size={16} strokeWidth={1.75} />
            Planilha do chefe
          </a>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="truncate text-xs text-concreto-200">{usuario.nome}</p>
              <p className="rotulo text-[10px] text-concreto-300/50">{usuario.papel}</p>
            </div>
            <form action="/api/sair" method="post">
              <button
                type="submit"
                aria-label="Sair"
                className="rounded p-1.5 text-concreto-300/60 hover:bg-grafite-700 hover:text-concreto"
              >
                <LogOut size={16} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── topo (mobile) ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-concreto-200 bg-grafite px-4 py-3 lg:hidden">
        <div className="flex items-baseline gap-2">
          <span className="h-2 w-2 rounded-sm bg-hivis" aria-hidden />
          <span className="rotulo text-sm text-concreto">Frota</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/api/exportar"
            aria-label="Baixar planilha"
            className="rounded p-2 text-concreto-200 hover:bg-grafite-700"
          >
            <FileDown size={18} strokeWidth={1.75} />
          </a>
          <form action="/api/sair" method="post">
            <button
              type="submit"
              aria-label="Sair"
              className="rounded p-2 text-concreto-200 hover:bg-grafite-700"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </header>

      {/* ── conteúdo ─────────────────────────────────────────────────────── */}
      <main className="pb-20 lg:ml-56 lg:pb-0">{children}</main>

      {/* ── barra inferior (mobile) — alcance do polegar ─────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-concreto-200 bg-white lg:hidden">
        {itens.map(({ href, rotulo, Icone }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
              ativo(href) ? 'text-grafite' : 'text-grafite-600/50'
            )}
          >
            <span className="relative">
              {ativo(href) && (
                <span
                  className="absolute -top-2.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-hivis"
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
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-concreto-200 bg-white px-4 py-4 sm:px-6">
      <div>
        <h1 className="font-cond text-2xl font-semibold uppercase tracking-wide text-grafite">
          {titulo}
        </h1>
        {descricao && <p className="mt-0.5 text-sm text-grafite-600">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
