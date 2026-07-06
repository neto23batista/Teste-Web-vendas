// Sentry no navegador é OPT-IN por DSN público. O import é DINÂMICO e só é
// resolvido quando há NEXT_PUBLIC_SENTRY_DSN. No estado atual (sem DSN) a
// condição é `false` em build-time → o import vira código morto e é removido:
// NENHUM byte do SDK do Sentry entra no bundle do cliente. Todo visitante
// economiza esse JS de first-load. Para ativar, basta definir a env e redeployar.
//
// Obs.: a instrumentação de navegação do App Router (onRouterTransitionStart) só
// faz sentido com o Sentry ativo; foi removida junto — reabilitar exige o import
// estático de volta (e o custo no bundle). O Sentry de SERVIDOR fica em
// src/instrumentation.ts, que já é import dinâmico condicional (sem custo aqui).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0
      ),
    });
  });
}
