import { API_ERROR_CODES, ERROR_MESSAGES, type ActionMetadata, type ApiErrorCode, type ApiFailure, type ApiResult } from "@/contracts/result";

const retryableCodes = new Set<ApiErrorCode>(["RATE_LIMITED", "NETWORK_ERROR", "TIMEOUT"]);
const validationMessages: Array<[RegExp, string]> = [
  [/dados de acesso|e-mail e senha|senha atual incorret/, "Dados de acesso ou código de autenticação incorretos."],
  [/cpf.*(invalid|valid)|informe um cpf/, "Informe um CPF válido."],
  [/telefone.*ddd|telefone.*valid/, "Informe um telefone com DDD válido."],
  [/nome completo/, "Informe seu nome completo."],
  [/senhas nao conferem/, "As senhas não conferem."],
  [/senha.*12.*64/, "A senha precisa ter entre 12 e 64 caracteres."],
  [/codigo de 6 digitos/, "Informe o código de 6 dígitos do seu autenticador."],
  [/codigo invalido ou expirado/, "O código é inválido ou expirou. Gere um novo e tente novamente."],
  [/informe.*motivo|motivo.*obrigatorio/, "Informe o motivo desta operação."],
  [/informe o cep|cep com 8|ceps com 8/, "Informe um CEP com 8 dígitos."],
  [/nao entregamos neste cep/, "Ainda não entregamos neste CEP. Escolha outro endereço."],
  [/aceite os termos|politica de privacidade/, "Leia e aceite os Termos e a Política de Privacidade atuais para continuar."],
  [/ja esta cadastrad|e-mail ou cpf ja|cpf ja esta vinculad/, "Não foi possível cadastrar estes dados. Confira as informações ou recupere seu acesso."],
];

export function apiFailure(code: ApiErrorCode, reference?: string): ApiFailure {
  return { ok: false, code, message: ERROR_MESSAGES[code], error: ERROR_MESSAGES[code], retryable: retryableCodes.has(code), ...(reference ? { reference } : {}) };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

/** Redirects are framework control flow, never an application error. */
export function isNavigationError(error: unknown): boolean {
  const digest = record(error)?.digest;
  return typeof digest === "string" && (
    digest.startsWith("NEXT_REDIRECT;") || digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;")
  );
}

export function publicError(cause: unknown, fallback: ApiErrorCode = "INTERNAL_ERROR"): ApiFailure {
  const entry = record(cause);
  const raw = typeof cause === "string" ? cause : typeof entry?.error === "string" ? entry.error : typeof entry?.message === "string" ? entry.message : "";
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let code = fallback;
  if (typeof entry?.code === "string" && API_ERROR_CODES.includes(entry.code as ApiErrorCode)) code = entry.code as ApiErrorCode;
  else if (entry?.name === "AbortError") code = "ABORTED";
  else if (entry?.name === "TimeoutError") code = "TIMEOUT";
  // Technical diagnostics can mention a coupon/stock column; those words do not
  // prove a business rejection or make it safe to rotate a checkout retry key.
  else if (/p2034|deadlock/.test(text)) code = "CONFLICT";
  else if (/prisma|invocation|sql\b|postgres|database|\bp\d{4}\b|password=|sk_(live|test)_|node_modules|econn|enotfound/.test(text)) code = "INTERNAL_ERROR";
  else if (/nao foi possivel criar o pedido/.test(text)) code = "INTERNAL_ERROR";
  else if (/nao autenticad|faca login|entre na sua conta|sessao expir|unauthoriz/.test(text)) code = "UNAUTHORIZED";
  else if (/sem permiss|nao autorizado|apenas (a matriz|o dono)|restrit[ao].*matriz/.test(text)) code = "FORBIDDEN";
  else if (/muitas (tentativas|atualizacoes)|rate.?limit/.test(text)) code = "RATE_LIMITED";
  else if (/pedido.*(mudou|cancelado|nao pode|ja esta)|transicao invalida|checkout expirou|tentativa ja foi encerrada/.test(text)) code = "ORDER_STATE_CHANGED";
  else if (/outra operacao|ja foi analisad|ja passou|ultimo.*(dono|owner)|p2034|deadlock/.test(text)) code = "CONFLICT";
  else if (/estoque|saldo (disponivel|devolvivel)|lote.*(vencid|saldo)/.test(text)) code = "OUT_OF_STOCK";
  else if (/cupom/.test(text)) code = "INVALID_COUPON";
  else if (/stripe|paymentintent|reembolso|pagamento|pix.*indisponivel/.test(text)) code = "PAYMENT_UNAVAILABLE";
  else if (/nao encontrad|not found/.test(text)) code = "NOT_FOUND";
  else if (/failed to fetch|networkerror|network request/.test(text)) code = "NETWORK_ERROR";
  else if (/informe|selecione|confira|invalid|obrigatori|preencha|senha.*incorret|codigo.*expirad|limite de|deve (ser|conter)|ja existe|ja esta cadastrad/.test(text) || validationMessages.some(([pattern]) => pattern.test(text))) code = "VALIDATION_ERROR";
  const reference = entry?.reference ?? entry?.digest;
  const safeReference = typeof reference === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(reference) ? reference : undefined;
  const failure = apiFailure(code, safeReference);
  const fieldMessage = code === "VALIDATION_ERROR" ? validationMessages.find(([pattern]) => pattern.test(text))?.[1] : undefined;
  if (fieldMessage) return { ...failure, message: fieldMessage, error: fieldMessage };
  if (text === "conta criada! faca login para continuar.") {
    return { ...failure, message: "Sua conta foi criada. Entre para continuar.", error: "Sua conta foi criada. Entre para continuar." };
  }
  return failure;
}

/** No provider/database string is reflected, even when a legacy action returns it. */
export function safeWarning(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/reembolso|liquida[cç][aã]o/i.test(value)) {
    return /falh|indispon[ií]vel|precisa ser retomad/i.test(value)
      ? "A alteração foi registrada, mas o reembolso precisa de acompanhamento no painel."
      : "A alteração foi registrada. O reembolso ainda aguarda confirmação; acompanhe pelo painel.";
  }
  return "A alteração foi registrada com uma pendência. Atualize a página para conferir os detalhes.";
}

type LegacyMetadata = ActionMetadata & { warning?: string };
export type LegacyActionResult<R> = NonNullable<R> extends object ? NonNullable<R> & LegacyMetadata : { ok: boolean; error?: string } & LegacyMetadata;

function cleanPayload(value: Record<string, unknown>) {
  const { ok: _ok, error: _error, warning: _warning, code: _code, message: _message, reference: _reference, retryable: _retryable, data: _data, ...payload } = value;
  void [_ok, _error, _warning, _code, _message, _reference, _retryable, _data];
  if (Array.isArray(payload.errors)) payload.errors = payload.errors.map((error) => {
    const line = typeof error === "string" ? /^Linha (\d{1,6})[: ]/i.exec(error)?.[1] : undefined;
    return `${line ? `Linha ${line}: ` : ""}${publicError(error, "VALIDATION_ERROR").message}`;
  });
  return payload;
}

/** New consumers use data; existing forms keep their old flattened payload. */
export function normalizeActionResult<R>(value: R): LegacyActionResult<R> {
  const source = record(value);
  if (!source) return apiFailure("INVALID_RESPONSE") as LegacyActionResult<R>;
  const payload = cleanPayload(source);
  if (source.ok === false || typeof source.error === "string" && source.error.length > 0) {
    return { ...payload, ...publicError(source) } as LegacyActionResult<R>;
  }
  const warning = safeWarning(source.warning);
  const message = typeof source.message === "string" ? "Operação confirmada." : undefined;
  return { ...payload, ok: true, data: payload, ...(message ? { message } : {}), ...(warning ? { warning } : {}) } as LegacyActionResult<R>;
}

export function asApiResult<T>(value: { ok?: boolean; data?: unknown; error?: string; code?: ApiErrorCode; message?: string; warning?: string; reference?: string }): ApiResult<T> {
  return value.ok === true ? { ok: true, data: value.data as T, ...(value.warning ? { warning: safeWarning(value.warning) } : {}) } : publicError(value);
}

/** Invokes exactly once: retries of financial/admin mutations require user intent. */
export function adaptAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  options: { invalidate?: () => void; failureDefaults?: Record<string, unknown> } = {},
): (...args: A) => Promise<LegacyActionResult<R>> {
  return async (...args) => {
    try {
      const result = normalizeActionResult(await action(...args));
      options.invalidate?.();
      return result;
    } catch (error) {
      options.invalidate?.();
      if (isNavigationError(error)) throw error;
      return { ...options.failureDefaults, ...publicError(error) } as LegacyActionResult<R>;
    }
  };
}

/** Bound only read operations: a late response is ignored, never retried. */
export function withReadTimeout<A extends unknown[], R>(read: (...args: A) => Promise<R>, timeoutMs = 12_000): (...args: A) => Promise<R> {
  return async (...args) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        read(...args),
        new Promise<R>((resolve) => { timer = setTimeout(() => resolve(apiFailure("TIMEOUT") as R), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
