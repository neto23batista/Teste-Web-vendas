// Log estruturado de erros de servidor (JSON no stdout) — fácil de coletar por
// qualquer agregador de logs. O envio ao Sentry acontece no hook
// `onRequestError` ([src/instrumentation.ts]) quando há DSN, evitando captura
// dupla; aqui mantemos só o log estruturado, sempre ativo.

type ErrorContext = Record<string, string | undefined>;

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      message,
      ...context,
      stack,
      at: new Date().toISOString(),
    })
  );
}
