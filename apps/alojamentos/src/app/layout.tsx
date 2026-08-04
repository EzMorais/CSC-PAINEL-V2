import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

// Next self-hospeda as duas no build (baixa e serve do próprio domínio) — mesmo
// resultado do @font-face manual do DESIGN-SYSTEM.md §4, sem gerenciar .woff2 à mão.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Alojamentos — Siqueira Campos',
  description: 'Alojamentos, moradores, pedidos e programação',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* A navegação não fica aqui: `/entrar` renderiza fora dela. Quem monta a
            casca é `(app)/layout.tsx`, depois de confirmar a sessão. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
