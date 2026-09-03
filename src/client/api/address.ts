import { z } from "zod";
import type { ApiResult } from "@/contracts/result";
import type { RequestOptions } from "@/client/api/http";
import { apiFailure, publicError } from "@/client/api/result";

const viaCepSchema = z.object({
  logradouro: z.string().max(500).optional(), bairro: z.string().max(500).optional(),
  localidade: z.string().max(200).optional(), uf: z.string().regex(/^[A-Z]{2}$/).optional(),
  erro: z.union([z.boolean(), z.literal("true")]).optional(),
});
export type CepResult = { street: string; district: string; city: string; state: string };

/** Public postal lookup uses a fixed origin and never forwards account credentials. */
export async function lookupCepResult(raw: string, options: RequestOptions = {}): Promise<ApiResult<CepResult>> {
  const cep = raw.replace(/\D/g, "");
  if (cep.length !== 8) return apiFailure("VALIDATION_ERROR");
  if (options.signal?.aborted) return apiFailure("ABORTED");
  const timeout = AbortSignal.timeout(Math.max(1, options.timeoutMs ?? 8_000));
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal, cache: "no-store", credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) return apiFailure("NETWORK_ERROR");
    const result = viaCepSchema.safeParse(await response.json());
    if (!result.success) return apiFailure("INVALID_RESPONSE");
    if (result.data.erro) return apiFailure("NOT_FOUND");
    if (!result.data.localidade || !result.data.uf) return apiFailure("INVALID_RESPONSE");
    return { ok: true, data: { street: result.data.logradouro ?? "", district: result.data.bairro ?? "", city: result.data.localidade ?? "", state: result.data.uf ?? "" } };
  } catch (error) {
    if (timeout.aborted) return apiFailure("TIMEOUT");
    return publicError(error, "NETWORK_ERROR");
  }
}

/** Compatibility for existing autofill forms; failures leave manual entry available. */
export async function lookupCep(raw: string, options: RequestOptions = {}): Promise<CepResult | null> {
  const result = await lookupCepResult(raw, options);
  return result.ok ? result.data : null;
}
