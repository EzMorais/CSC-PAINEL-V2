import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ProvedorTema } from '@/components/Tema';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Frota — Siqueira Campos',
  description: 'Controle de frota, manutenção e abastecimento',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12161C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` porque o next-themes escreve a classe do tema no <html>
    // antes do React assumir — sem isto, todo carregamento avisa que o HTML não bate.
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ProvedorTema>{children}</ProvedorTema>
      </body>
    </html>
  );
}
