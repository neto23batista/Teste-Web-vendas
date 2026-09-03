export const API_ERROR_CODES = [
  "UNAUTHORIZED", "FORBIDDEN", "VALIDATION_ERROR", "NOT_FOUND", "OUT_OF_STOCK",
  "INVALID_COUPON", "PAYMENT_UNAVAILABLE", "ORDER_STATE_CHANGED", "CONFLICT",
  "RATE_LIMITED", "NETWORK_ERROR", "TIMEOUT", "ABORTED", "INVALID_RESPONSE",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type ApiFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  reference?: string;
  retryable: boolean;
  /** Compatibility during migration of existing forms. */
  error: string;
};
export type ApiSuccess<T> = { ok: true; data: T; warning?: string };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Existing form state remains assignable to useActionState's initial value. */
export type ActionMetadata = {
  code?: ApiErrorCode;
  message?: string;
  reference?: string;
  retryable?: boolean;
  data?: unknown;
};
export type FormState = ({ error?: string; ok?: boolean; success?: boolean } & ActionMetadata) | undefined;

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
  FORBIDDEN: "Seu acesso não permite realizar esta ação.",
  VALIDATION_ERROR: "Confira os dados informados e tente novamente.",
  NOT_FOUND: "O registro não está mais disponível. Atualize a página.",
  OUT_OF_STOCK: "O estoque mudou. Revise sua sacola ou atualize a página.",
  INVALID_COUPON: "O cupom não pode ser aplicado a esta compra. Revise o código e as condições.",
  PAYMENT_UNAVAILABLE: "Não foi possível confirmar a operação de pagamento. Consulte o estado do pedido antes de tentar novamente.",
  ORDER_STATE_CHANGED: "O pedido mudou em outra operação. Atualize a página antes de continuar.",
  CONFLICT: "Este registro mudou em outra operação. Atualize a página antes de continuar.",
  RATE_LIMITED: "Muitas tentativas em sequência. Aguarde um instante e tente novamente.",
  NETWORK_ERROR: "A conexão foi interrompida. Consulte o estado da operação antes de tentar novamente.",
  TIMEOUT: "A confirmação demorou mais que o esperado. Consulte o estado da operação antes de tentar novamente.",
  ABORTED: "A consulta foi interrompida.",
  INVALID_RESPONSE: "Não foi possível interpretar a resposta. Atualize a página e tente novamente.",
  INTERNAL_ERROR: "Não foi possível confirmar a operação. Atualize a página para verificar o estado atual.",
};
