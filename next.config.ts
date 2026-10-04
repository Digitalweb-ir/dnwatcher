import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname),
  serverExternalPackages: [],
}

export default nextConfig