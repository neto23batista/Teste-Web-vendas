import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const isDev = process.env.NODE_ENV !== "production";

/** Nonce base64 por requisição (Web Crypto — edge-safe). */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * CSP estrita por nonce (produção). O Next aplica o nonce nos seus <script>
 * inline ao ler o header Content-Security-Policy DA REQUISIÇÃO; com
 * 'strict-dynamic', os chunks que o bootstrap injeta herdam a confiança.
 * 'unsafe-inline' e https: em script-src são IGNORADOS por browsers modernos
 * quando há nonce — ficam só como fallback para browsers antigos.
 *
 * Em dev, Turbopack/React Refresh usam eval e scripts inline sem nonce —
 * política relaxada (o e2e de qualidade valida a estrita no build de produção).
 */
function buildCsp(nonce: string): string {
  const script = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`;
  const connect = `connect-src 'self'${isDev ? " ws: wss:" : ""} https://api.mercadopago.com https://viacep.com.br https://*.sentry.io`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Estilos inline em ATRIBUTOS (framer-motion/recharts/sonner) exigem
    // 'unsafe-inline' aqui; CSS não executa script — risco baixo.
    "style-src 'self' 'unsafe-inline'",
    script,
    connect,
    // strict-dynamic descarta allowlist de host em script-src; o service
    // worker (sw.js) e workers blob (Sentry) precisam de worker-src explícito.
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.mercadopago.com",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.mercadopago.com",
  ].join("; ");
}

export default auth((req) => {
  // A proteção de rota vive em authConfig.callbacks.authorized (roda antes).
  const nonce = makeNonce();
  const csp = buildCsp(nonce);

  // x-nonce fica disponível via headers() para componentes que renderizam
  // <script> inline próprio (ex.: next-themes no layout raiz).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

// Toda rota que renderiza página passa aqui (nonce por requisição). Fora:
// assets estáticos e /api — respostas JSON não executam script e as rotas de
// API fazem a própria autorização.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml|webmanifest)).*)",
  ],
};
