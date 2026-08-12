import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  distDir: process.env.NEXT_DIST_DIR ?? '.next-runtime',
  turbopack: { root: path.resolve(__dirname) },
}

export default nextConfig
