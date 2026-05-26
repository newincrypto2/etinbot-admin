import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // potrzebne dla Dockerfile
  experimental: {
    serverActions: {
      // Lista hostów Coolify, z których panel akceptuje server actions.
      // Lokalnie localhost wystarcza; produkcyjnie dodajemy subdomenę.
      allowedOrigins: [
        'localhost:3000',
        process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? '',
      ].filter(Boolean),
    },
  },
}

export default nextConfig
