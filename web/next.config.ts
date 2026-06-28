import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Gera os arquivos estáticos para o Electron
  assetPrefix: "./",
  allowedDevOrigins: ["192.168.24.43"],
  images: {
    unoptimized: true, // Impede que o Next.js tente usar um servidor para otimizar as capas
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
