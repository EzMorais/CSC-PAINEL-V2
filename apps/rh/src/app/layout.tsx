import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Next self-hospeda as duas no build (baixa e serve do próprio domínio) — mesmo
// resultado do @font-face manual do DESIGN-SYSTEM.md §4, sem gerenciar .woff2 à mão.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RH e SST — Siqueira Campos",
  description: "Recursos humanos e saúde e segurança do trabalho",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  );
}
