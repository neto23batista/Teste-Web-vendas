import { redactLogValue } from "@/lib/monitoring";

const SENSITIVE_KEY = /(?:^|[_-])(?:authorization|proxy-authorization|cookie|cookies|set-cookie|password|passwd|secret|token|access-token|refresh-token|api-key|client-secret|session|email|cpf|tax-id|phone|telephone|mobile|ip-address|postal-code|zip-code|payload|raw|body)(?:$|[_-])/i;
const IDENTITY_KEY = /^(?:user|username|address|shippingAddress|billingAddress|customerName|payerName|recipientName)$/i;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/([a-z\d])([A-Z])/g, "$1-$2");
  return SENSITIVE_KEY.test(normalized) || IDENTITY_KEY.test(key);
}

export function sanitizeTelemetryString(value: string): string {
  return redactLogValue(value)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[redacted-cpf]")
    .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, "$1?[redacted]");
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") return sanitizeTelemetryString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 12) return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = sanitizeValue(child, depth + 1, seen);
    }
  }
  return output;
}

/**
 * Defesa final antes do envio ao Sentry. Remove a identidade padrão e
 * higieniza request, contexto, breadcrumbs e mensagens sem alterar o original.
 */
export function scrubSentryEvent<T>(event: T): T {
  const scrubbed = sanitizeValue(event, 0, new WeakSet<object>());
  if (scrubbed && typeof scrubbed === "object" && !Array.isArray(scrubbed)) {
    const root = scrubbed as Record<string, unknown>;
    delete root.user;
    if (root.request && typeof root.request === "object" && !Array.isArray(root.request)) {
      const request = root.request as Record<string, unknown>;
      for (const key of ["data", "cookies", "query_string", "env"]) {
        if (key in request) request[key] = "[redacted]";
      }
    }
  }
  return scrubbed as T;
}
