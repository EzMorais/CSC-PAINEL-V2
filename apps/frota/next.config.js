/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  outputFileTracingIncludes: { '/**': ['./prisma/**'] },
  eslint: { ignoreDuringBuilds: true },
};
