"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * O ícone troca por CSS, não por estado. O next-themes escreve a classe `dark`
 * no <html> num script bloqueante antes da primeira pintura, então o mesmo HTML
 * serve para os dois temas — não há descasamento de hidratação nem o quadrado
 * vazio que um guarda de `montado` deixaria no lugar do botão.
 *
 * Vive dentro da sidebar, que é sempre escura — por isso usa os tokens `sidebar-*`
 * (fixos) em vez de `border/muted-foreground/accent` (que seguem o tema do app).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar entre tema claro e escuro"
      className="grid size-9 shrink-0 place-items-center rounded-md border border-border
                 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
