/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: { '/**': ['./prisma/**'] },
  eslint: { ignoreDuringBuilds: true },
};
