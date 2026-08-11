"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Truck,
  Wrench,
  Fuel,
  Bell,
  LogOut,
  FileDown,
  LayoutGrid,
  X,
} from "lucide-react";
import { BotaoTema } from "@/components/Tema";

const itens = [
  { href: "/veiculos", rotulo: "Veículos", Icone: Truck },
  { href: "/manutencoes", rotulo: "Manutenções", Icone: Wrench },
  { href: "/abastecimento", rotulo: "Abastecimento", Icone: Fuel },
  { href: "/alertas", rotulo: "Alertas", Icone: Bell },
];

const modulos = [
  {
    rotulo: "Portal",
    url: process.env.NEXT_PUBLIC_URL_PORTAL ?? "http://localhost:3004",
  },
  {
    rotulo: "Programação diária",
    url: process.env.NEXT_PUBLIC_URL_PROGRAMACAO ?? "http://localhost:3007",
  },
  {
    rotulo: "Painel de locação",
    url: process.env.NEXT_PUBLIC_URL_PAINEL ?? "http://localhost:3001",
  },
  {
    rotulo: "RH e SST",
    url: process.env.NEXT_PUBLIC_URL_RH ?? "http://localhost:3002",
  },
  {
    rotulo: "Almoxarifado",
    url: process.env.NEXT_PUBLIC_URL_ESTOQUE ?? "http://localhost:3003",
  },
  {
    rotulo: "Alojamentos",
    url: process.env.NEXT_PUBLIC_URL_ALOJAMENTOS ?? "http://localhost:3005",
  },
];

export function Casca({
  usuario,
  children,
}: {
  usuario: { nome: string; papel: string };
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const [hubAberto, setHubAberto] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);
  const ativo = (href: string) =>
    caminho === href || caminho.startsWith(`${href}/`);

  useEffect(() => {
    if (!hubAberto) return;
    function fecharAoClicarFora(evento: MouseEvent) {
      if (hubRef.current && !hubRef.current.contains(evento.target as Node))
        setHubAberto(false);
    }
    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setHubAberto(false);
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    document.addEventListener("keydown", fecharComEscape);
    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [hubAberto]);

  return (
    <div className="min-h-dvh bg-concreto text-grafite">
      <header className="sticky top-0 z-30 border-b-2 border-concreto-300 bg-concreto/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-8">
          <Link href="/veiculos" className="flex min-w-0 items-center gap-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-hivis text-grafite shadow-[3px_3px_0_rgb(18_22_28_/_0.25)]"
              aria-hidden
            >
              <Truck size={17} strokeWidth={2} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-semibold">
                Construtora Siqueira Campos
              </span>
              <span className="block truncate text-xs text-grafite-600">
                Frota e mobilidade
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navegação da frota"
            className="order-3 flex min-w-0 max-w-full flex-1 flex-wrap gap-1 rounded-xl bg-concreto-100 p-1 sm:order-none sm:flex-nowrap sm:overflow-x-auto"
          >
            {itens.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={ativo(href) ? "page" : undefined}
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  ativo(href)
                    ? "bg-superficie font-medium text-grafite shadow-sm"
                    : "text-grafite-600 hover:bg-superficie/70 hover:text-grafite",
                )}
              >
                <Icone size={16} strokeWidth={1.8} /> {rotulo}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden max-w-44 text-right sm:block">
              <p className="truncate text-sm font-medium" title={usuario.nome}>
                {usuario.nome}
              </p>
              <p
                className="truncate text-xs text-grafite-600"
                title={usuario.papel}
              >
                {usuario.papel}
              </p>
            </div>
            <BotaoTema className="size-9 border border-concreto-300 text-grafite-600 hover:bg-concreto-100 hover:text-grafite" />
            <form action="/api/sair" method="post">
              <button
                type="submit"
                aria-label="Sair"
                className="grid size-9 place-items-center rounded-md border border-concreto-300 bg-superficie text-grafite-600 shadow-sm hover:bg-concreto-100 hover:text-grafite"
              >
                <LogOut size={16} strokeWidth={1.8} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="pb-8">{children}</main>

      <div ref={hubRef} className="fixed bottom-4 right-4 z-50">
        {hubAberto && (
          <div
            role="menu"
            aria-label="Navegação rápida entre sistemas"
            className="absolute bottom-14 right-0 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-concreto-300 bg-superficie shadow-xl"
          >
            <p className="border-b border-concreto-300 px-3 py-2 text-xs font-medium text-grafite-600">
              Sistemas Siqueira Campos
            </p>
            <div className="p-1">
              {modulos.map((modulo) => (
                <a
                  key={modulo.url}
                  href={modulo.url}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-grafite-600 transition-colors hover:bg-concreto-100 hover:text-grafite"
                >
                  {modulo.rotulo}
                </a>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHubAberto((valor) => !valor)}
          aria-label={
            hubAberto ? "Fechar navegação rápida" : "Abrir navegação rápida"
          }
          aria-expanded={hubAberto}
          className="grid size-12 place-items-center rounded-full bg-hivis text-grafite shadow-lg transition-transform hover:scale-105"
        >
          {hubAberto ? <X size={20} /> : <LayoutGrid size={20} />}
        </button>
      </div>
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
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-end justify-between gap-3 border-b border-concreto-300 px-4 py-5 sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-grafite">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-0.5 text-sm text-grafite-600">{descricao}</p>
        )}
      </div>
      {acao}
    </div>
  );
}
