import * as Sentry from "@sentry/nextjs";

// Inicializa o Sentry no cliente apenas quando há DSN público (opt-in).
// Sem DSN, fica inativo — nenhum evento é enviado.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

// Instrumentação de navegação do App Router (no-op quando o Sentry não foi iniciado).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
