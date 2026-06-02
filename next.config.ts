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
      // Załączniki maili idą przez server action (uploadAttachment). Domyślny
      // limit ciała server action to 1 MB → plik np. 5 MB wywalał całą stronę.
      // Podnosimy do 25 MB (backend przyjmuje 20 MB + zapas na narzut multipart).
      bodySizeLimit: '25mb',
    },
  },
}

export default nextConfig
