'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ProvedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

/**
 * O botão de alternar claro/escuro.
 *
 * Só renderiza depois de montado: no servidor não há como saber o tema escolhido, e
 * desenhar o ícone antes disso faz o React reclamar de HTML diferente entre servidor e
 * navegador — e o botão pisca com o ícone errado no primeiro carregamento.
 */
export function BotaoTema({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const escuro = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      data-testid="tema"
      className={`grid size-9 place-items-center rounded-md border border-concreto-300 text-grafite-600 transition-colors hover:bg-concreto-100 hover:text-grafite ${className}`}
    >
      {montado ? (
        escuro ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
