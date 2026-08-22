const INTERNAL_ORIGIN = "https://internal.invalid";
const UNSAFE_PATH_CHARS = /[\\\u0000-\u001f\u007f]/;

/**
 * Aceita somente destinos relativos à origem atual. Isso evita open redirect
 * por callbackUrl (`https://...`, `//...` e variantes com barra invertida).
 */
export function safeInternalRedirect(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    UNSAFE_PATH_CHARS.test(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return null;

    // Rejeite separadores/controles também quando vierem percent-encoded. Duas
    // passagens cobrem payloads duplamente codificados sem alterar o retorno.
    let decodedPath = parsed.pathname;
    for (let pass = 0; pass < 2; pass += 1) {
      const decoded = decodeURIComponent(decodedPath);
      if (decoded === decodedPath) break;
      decodedPath = decoded;
    }
    if (
      decodedPath.startsWith("//") ||
      decodedPath.startsWith("/\\") ||
      UNSAFE_PATH_CHARS.test(decodedPath)
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
