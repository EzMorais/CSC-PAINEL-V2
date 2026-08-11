"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Marca } from "@/components/marca/logo";
import { sair } from "@/actions/auth";

export type HudItem = { href: string; rotulo: string; Icone: LucideIcon };

export function HudProgramacao({
  usuario,
  itens,
  subtitulo = "Recursos humanos e SST",
}: {
  usuario: { nome: string; email: string; cargo?: string };
  itens: HudItem[];
  subtitulo?: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Marca className="size-8 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold">
              Construtora Siqueira Campos
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {subtitulo}
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navegação do módulo"
          className="order-3 flex min-w-0 max-w-full flex-1 flex-wrap gap-1 rounded-xl bg-muted/60 p-1 sm:order-none sm:flex-nowrap sm:overflow-x-auto"
        >
          {itens.map(({ href, rotulo, Icone }) => {
            const ativo =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${ativo ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
              >
                <Icone className="size-4" /> {rotulo}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden max-w-44 text-right sm:block">
            <p className="truncate text-sm font-medium" title={usuario.nome}>
              {usuario.nome}
            </p>
            <p
              className="truncate text-xs text-muted-foreground"
              title={usuario.email}
            >
              {usuario.cargo ?? usuario.email}
            </p>
          </div>
          <ThemeToggle />
          <form action={sair}>
            <button
              type="submit"
              data-testid="sair"
              aria-label="Sair"
              className="grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
