export const DEFAULT_MAX_REQUEST_BODY_BYTES = 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Corpo da requisição excede o limite de ${maxBytes} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Lê um corpo HTTP sem permitir que um payload sem Content-Length consuma
 * memória sem limite. O limite é aplicado tanto ao cabeçalho quanto ao stream.
 */
export async function readTextBodyLimited(
  request: Request,
  maxBytes = DEFAULT_MAX_REQUEST_BODY_BYTES
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("O limite do corpo precisa ser um inteiro positivo.");
  }

  const contentLength = request.headers.get("content-length")?.trim();
  if (contentLength && /^\d+$/.test(contentLength)) {
    if (BigInt(contentLength) > BigInt(maxBytes)) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
