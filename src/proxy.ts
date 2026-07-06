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
  // Proteção de rota: é o MIDDLEWARE quem redireciona quem não pode ver a
  // página. Sem isto, um visitante SEM login chega no RSC de /conta|/checkout|
  // /admin e requireUser()/requireAdmin() lançam → aparece o error boundary
  // ("Algo deu errado") no lugar da tela de login. Atenção: no modo
  // `auth((req) => ...)` o callback `authorized` do authConfig NÃO é aplicado
  // automaticamente — a decisão precisa ser feita aqui.
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const user = req.auth?.user;
  const needsAuth =
    pathname.startsWith("/conta") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/admin");

  if (needsAuth && !user) {
    const login = new URL("/login", nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (pathname.startsWith("/admin") && user?.role !== "ADMIN") {
    // Logado, mas sem permissão de admin: manda para a loja (não vaza o painel).
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

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
