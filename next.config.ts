import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // potrzebne dla Dockerfile
  experimental: {
    serverActions: {
      // Lista hostów Coolify, z których panel akceptuje server actions.
      // Lokalnie localhost wystarcza; produkcyjnie dodajemy subdomenę.
      // Uwaga: next.config jest ewaluowany w BUILDZIE, a env z Coolify są
      // runtime'owe — dlatego domeny produkcyjne są wypisane wprost, a nie
      // wyłącznie z NEXTAUTH_URL.
      allowedOrigins: [
        'localhost:3000',
        'panel.etinbot.pl',
        'etinbotadmin.dewflow.cloud',
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
