import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname),
  serverExternalPackages: ['ssh2', 'socks-proxy-agent'],
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Don't bundle native modules
      config.externals = config.externals || []
      config.externals.push({
        'ssh2': 'commonjs ssh2',
        'socks-proxy-agent': 'commonjs socks-proxy-agent',
      })
    }
    // Ignore native .node files
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    })
    return config
  },
}

export default nextConfig