import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Programação — Construtora Siqueira Campos',
  description: 'Quem trabalha em qual frente, e a frota de cada uma',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* A navegação não fica aqui: `/entrar` renderiza fora dela. Quem monta a
            casca é `(app)/layout.tsx`, depois de confirmar a sessão. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
