import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as rotas.
// HSTS só tem efeito sob HTTPS (produção). A CSP começa em modo Report-Only
// porque o Next injeta scripts inline; evoluir para enforce com nonce depois.
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
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://api.mercadopago.com https://viacep.com.br",
      "frame-src 'self' https://*.mercadopago.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.mercadopago.com",
    ].join("; "),
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

  // Imagens de produto vêm de URLs https (cadastradas no admin). O next/image
  // otimiza e serve a partir da própria origem (/_next/image), então a CSP
  // img-src 'self' já cobre a exibição.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Para deploy em container (Docker), descomente:
  // output: "standalone",
};

export default nextConfig;
