// Log estruturado de erros de servidor (JSON no stdout) — fácil de coletar por
// qualquer agregador de logs. O envio ao Sentry acontece no hook
// `onRequestError` ([src/instrumentation.ts]) quando há DSN, evitando captura
// dupla; aqui mantemos só o log estruturado, sempre ativo.

type ErrorContext = Record<string, string | undefined>;

export function redactLogValue(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk_(?:test|live)_|whsec_|fvi_)[A-Za-z0-9_-]+/g, "[redacted-secret]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/((?:postgres(?:ql)?|redis(?:s)?|https?):\/\/)[^@\s/]+@/gi, "$1[redacted]@")
    .replace(/([?&](?:token|code|secret|key|password|signature)=)[^&\s]+/gi, "$1[redacted]");
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const message = redactLogValue(error instanceof Error ? error.message : String(error));
  const stack = error instanceof Error && error.stack
    ? redactLogValue(error.stack)
    : undefined;
  const safeContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      value ? redactLogValue(value) : value,
    ])
  );

  console.error(
    JSON.stringify({
      level: "error",
      message,
      ...safeContext,
      stack,
      at: new Date().toISOString(),
    })
  );
}
