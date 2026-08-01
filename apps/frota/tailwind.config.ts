import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grafite:  { DEFAULT: '#12161C', 800: '#1B2129', 700: '#2A323C', 600: '#3D4650' },
        concreto: { DEFAULT: '#F5F6F4', 100: '#EDEFEC', 200: '#E0E3DE', 300: '#CBD0C9' },
        hivis:    { DEFAULT: '#D7E021', escuro: '#A8AF19', fraco: '#F4F7C9' },
        sinal:    { DEFAULT: '#E4572E', fraco: '#FDEDE8' },
        ambar:    { DEFAULT: '#E09B2D', fraco: '#FDF3E2' },
        mata:     { DEFAULT: '#2D6A4F', fraco: '#E7F1EC' },
        aco:      { DEFAULT: '#3E6C8F', fraco: '#E9F0F5' },
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
