/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: { '/**': ['./prisma/**'] },
  // Frota continua num processo Next.js durante a migração, mas é publicado pelo ERP Go
  // em uma porta única. O prefixo também isola os assets em /frota/_next.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  eslint: { ignoreDuringBuilds: true },
};
