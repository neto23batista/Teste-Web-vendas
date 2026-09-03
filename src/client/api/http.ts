import type { z } from "zod";
import type { ApiErrorCode, ApiResult } from "@/contracts/result";
import { apiFailure, publicError } from "@/client/api/result";

export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };
type JsonOptions = RequestOptions & { method?: "GET" | "POST"; body?: unknown };

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404 || status === 410) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

/** Same-origin BFF transport; a mutation is never automatically repeated. */
export async function requestJson<T>(path: string, schema: z.ZodType<T>, options: JsonOptions = {}): Promise<ApiResult<T>> {
  if (!path.startsWith("/api/") || path.startsWith("//")) return apiFailure("INVALID_RESPONSE");
  if (options.signal?.aborted) return apiFailure("ABORTED");
  const controller = new AbortController();
  let timedOut = false;
  let rejectAbort: (error: unknown) => void = () => {};
  const canceled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    rejectAbort(new DOMException("Request aborted", timedOut ? "TimeoutError" : "AbortError"));
  };
  const timeout = setTimeout(() => { timedOut = true; abort(); }, Math.max(1, options.timeoutMs ?? 12_000));
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([canceled, (async (): Promise<ApiResult<T>> => {
      const response = await fetch(path, {
        method: options.method ?? "GET", credentials: "same-origin", cache: "no-store",
        signal: controller.signal, headers: { Accept: "application/json", ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const reference = response.headers.get("x-request-id") ?? undefined;
        return publicError({ code: codeForStatus(response.status), reference });
      }
      if (!response.headers.get("content-type")?.includes("application/json")) {
        await response.body?.cancel();
        return apiFailure(response.redirected ? "UNAUTHORIZED" : "INVALID_RESPONSE");
      }
      let raw: unknown;
      try { raw = await response.json(); } catch { return apiFailure(controller.signal.aborted ? timedOut ? "TIMEOUT" : "ABORTED" : "INVALID_RESPONSE"); }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return apiFailure("INVALID_RESPONSE");
      return { ok: true, data: parsed.data };
    })()]);
  } catch (error) {
    return publicError(error, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
