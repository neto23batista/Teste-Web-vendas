import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as rotas.
// HSTS só tem efeito sob HTTPS (produção).
// A Content-Security-Policy NÃO vive aqui: ela é estrita por nonce e precisa
// mudar a cada requisição — é montada e aplicada no middleware (src/proxy.ts).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Permite build/start num diretório separado (evita lock do dev sobre .next).
  // Em uso normal NEXT_BUILD_DIST não é definido, então fica em ".next".
  distDir: process.env.NEXT_BUILD_DIST || ".next",

  // Não expor a versão do framework.
  poweredByHeader: false,

  // Esconde o indicador de desenvolvimento do Next (o círculo "N" no canto).
  // Só aparece em dev; em produção já não existe.
  devIndicators: false,

  // Tree-shake imports de barris grandes: acelera a compilação no dev e
  // reduz o JS enviado ao cliente (só os ícones/animações usados entram).
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },

  // Imagens de produto vêm de CDNs https. Restringimos os hosts permitidos
  // (em vez de "**") para o otimizador do next/image não virar proxy aberto
  // (risco de SSRF/abuso). Hosts atuais: as fotos validadas do seed.
  // Para usar outro CDN, adicione o host nesta lista.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Para deploy em container (Docker), descomente:
  // output: "standalone",
};

export default nextConfig;
