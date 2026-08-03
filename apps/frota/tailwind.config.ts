import type { Config } from 'tailwindcss';

/**
 * A paleta vem de variáveis CSS, e não de valores fixos.
 *
 * É isso que permite o tema escuro sem reescrever componente nenhum: `bg-concreto` continua
 * escrito igual em toda a interface, e o que muda é o valor de `--cor-concreto` quando a
 * classe `dark` entra no <html>. A alternativa — pôr `dark:` em cada classe de cada tela —
 * seriam centenas de edições e uma chance de esquecer alguma em cada uma.
 *
 * `<alpha-value>` é o que mantém `bg-sinal/12` funcionando: sem ele o Tailwind não consegue
 * aplicar transparência sobre uma variável.
 */
const cor = (nome: string) => `rgb(var(${nome}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        grafite: {
          DEFAULT: cor('--cor-grafite'),
          800: cor('--cor-grafite-800'),
          700: cor('--cor-grafite-700'),
          600: cor('--cor-grafite-600'),
        },
        concreto: {
          DEFAULT: cor('--cor-concreto'),
          100: cor('--cor-concreto-100'),
          200: cor('--cor-concreto-200'),
          300: cor('--cor-concreto-300'),
        },
        /** A superfície de cartões e menus — era `bg-white` fixo. */
        superficie: cor('--cor-superficie'),
        /**
         * A barra lateral e o topo: escuros nos DOIS temas, de propósito.
         *
         * Eles já eram invertidos em relação ao corpo — fundo grafite, texto claro. Se
         * usassem a paleta normal, o tema escuro os deixaria claros, e a única parte
         * brilhante da tela seria justamente a moldura.
         */
        barra: {
          DEFAULT: cor('--cor-barra'),
          800: cor('--cor-barra-800'),
          700: cor('--cor-barra-700'),
          texto: cor('--cor-barra-texto'),
          suave: cor('--cor-barra-suave'),
        },
        hivis: {
          DEFAULT: cor('--cor-hivis'),
          escuro: cor('--cor-hivis-escuro'),
          fraco: cor('--cor-hivis-fraco'),
        },
        sinal: { DEFAULT: cor('--cor-sinal'), fraco: cor('--cor-sinal-fraco') },
        ambar: { DEFAULT: cor('--cor-ambar'), fraco: cor('--cor-ambar-fraco') },
        mata: { DEFAULT: cor('--cor-mata'), fraco: cor('--cor-mata-fraco') },
        aco: { DEFAULT: cor('--cor-aco'), fraco: cor('--cor-aco-fraco') },
      },
      fontFamily: {
        cond: ['var(--fonte-cond)', 'Arial Narrow', 'sans-serif'],
        sans: ['var(--fonte-corpo)', 'system-ui', 'sans-serif'],
        mono: ['var(--fonte-dado)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        rotulo: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
