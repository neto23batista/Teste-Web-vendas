import type { Instrumentation } from "next";

// Roda uma vez quando o servidor sobe. Validamos o ambiente aqui para
// falhar cedo (e só no runtime Node, nunca no edge). Inicializa o Sentry
// quando há DSN (caso contrário, no-op — opt-in por ambiente).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
  }

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    });
  }
}

// Hook do Next chamado para todo erro de servidor (RSC, route handlers, server
// actions). Centraliza a captura: log estruturado sempre + Sentry quando ligado.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const { reportError } = await import("@/lib/monitoring");
  reportError(err, {
    path: request?.path,
    method: request?.method,
    routeType: context?.routeType,
  });

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  }
};
