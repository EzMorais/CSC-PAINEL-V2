import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Sem isto o Turbopack empacota o pdfkit e embaralha o __dirname que ele usa pra achar
  // as fontes padrão (Helvetica.afm) — o PDF falha com ENOENT num caminho que não existe.
  // Mesmo ajuste do Painel de Locação.
  serverExternalPackages: ['pdfkit'],
}

export default nextConfig
