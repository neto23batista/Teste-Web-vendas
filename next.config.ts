import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as rotas.
// HSTS só tem efeito sob HTTPS (produção). A CSP é ENFORCED, mas mantém
// 'unsafe-inline'/'unsafe-eval' em script/style porque o Next/React injetam
// scripts inline e o Tailwind usa estilos inline — removê-los exige nonce por
// requisição (via proxy.ts) e validação em browser. Mesmo assim ela já protege
// contra clickjacking (frame-ancestors), injeção de <base>, sequestro de
// formulário (form-action) e bloqueia origens externas de script/connect/frame.
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
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Sentry (opt-in) envia eventos para *.ingest(.us).sentry.io — o wildcard
      // *.sentry.io cobre subdomínios multi-label; sem ele o enforce bloquearia
      // a telemetria no browser.
      "connect-src 'self' https://api.mercadopago.com https://viacep.com.br https://*.sentry.io",
      "frame-src 'self' https://*.mercadopago.com",
      "frame-ancestors 'none'",
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
