const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
module.exports = (phase) => ({
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: { '/**': ['./prisma/**'] },
  // O desenvolvimento nunca compartilha os manifests de `.next` usados por build,
  // `next start` e testes. O valor explícito permite um diretório próprio por suíte.
  distDir:
    process.env.NEXT_DIST_DIR ??
    (phase === PHASE_DEVELOPMENT_SERVER ? '.next-runtime' : '.next'),
  // Frota continua num processo Next.js durante a migração, mas é publicado pelo ERP Go
  // em uma porta única. O prefixo também isola os assets em /frota/_next.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  eslint: { ignoreDuringBuilds: true },
});
