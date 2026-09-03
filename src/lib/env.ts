import { z } from "zod";

// Variáveis obrigatórias para o servidor subir. Validadas no boot
// (src/instrumentation.ts) — falha cedo e com mensagem clara.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres"),
});

const PLACEHOLDER_SECRET = /(troque|change|example|placeholder|seu[-_ ]?segredo)/i;

function hasReasonableSecretEntropy(value: string): boolean {
  return new Set(value).size >= 10;
}

function isStrongRuntimeSecret(value: string | undefined): value is string {
  return Boolean(
    value &&
      value.length >= 32 &&
      !PLACEHOLDER_SECRET.test(value) &&
      hasReasonableSecretEntropy(value)
  );
}

function explicitFeatureFlag(name: string, errors: string[]): boolean | null {
  const value = process.env[name]?.trim().toLowerCase();
  if (value !== "true" && value !== "false") {
    errors.push(`${name} deve ser definido explicitamente como true ou false`);
    return null;
  }
  return value === "true";
}

function hasValidDurableRateLimit(errors: string[]): boolean {
  const restPairs: Array<[string | undefined, string | undefined, string]> = [
    [
      process.env.UPSTASH_REDIS_REST_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN,
      "UPSTASH_REDIS_REST",
    ],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN, "KV_REST_API"],
  ];
  for (const [url, token, label] of restPairs) {
    if (!url && !token) continue;
    if (
      !url ||
      !token ||
      token.length < 16 ||
      PLACEHOLDER_SECRET.test(token) ||
      !hasReasonableSecretEntropy(token)
    ) {
      errors.push(`${label}_URL/TOKEN devem formar um par válido`);
      return false;
    }
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
      return true;
    } catch {
      errors.push(`${label}_URL deve ser uma URL https:// válida`);
      return false;
    }
  }

  const tcpUrl = process.env.REDIS_URL;
  if (tcpUrl) {
    try {
      const protocol = new URL(tcpUrl).protocol;
      if (protocol !== "redis:" && protocol !== "rediss:") throw new Error();
      return true;
    } catch {
      errors.push("REDIS_URL deve ser uma URL redis:// ou rediss:// válida");
      return false;
    }
  }

  errors.push("Redis/KV durável é obrigatório para rate limit");
  return false;
}

/** Ambientes que a aplicação reconhece. Qualquer outro valor é erro de config. */
const KNOWN_ENVIRONMENTS = new Set([
  "production",
  "preview",
  "staging",
  "development",
  "test",
]);

/**
 * O ambiente declarado, ou `null` quando ninguém declarou nada reconhecível.
 * Se APP_ENV e VERCEL_ENV discordarem, "production" vence: a escolha segura é
 * tratar a instância como pública, não como sandbox.
 */
export function declaredEnvironment(): string | null {
  const declared = [process.env.APP_ENV, process.env.VERCEL_ENV]
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter((value) => KNOWN_ENVIRONMENTS.has(value));
  if (declared.length === 0) return null;
  return declared.includes("production") ? "production" : declared[0]!;
}

/**
 * Sinal inequívoco de que esta instância é a loja pública real.
 * `NODE_ENV=production` também é usado em build, preview e testes, portanto
 * não basta para habilitar controles que bloqueariam ambientes de validação —
 * a declaração é explícita, e `assertEnv` exige que ela exista num build de
 * produção justamente para que esquecê-la não afrouxe controle nenhum.
 */
export function isLiveProduction(): boolean {
  return declaredEnvironment() === "production";
}

export function assertEnv(): void {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  if (PLACEHOLDER_SECRET.test(parsed.data.AUTH_SECRET)) {
    throw new Error("Configuração de ambiente inválida:\n- AUTH_SECRET ainda é um placeholder");
  }
  if (!hasReasonableSecretEntropy(parsed.data.AUTH_SECRET)) {
    throw new Error(
      "Configuração de ambiente inválida:\n- AUTH_SECRET tem baixa diversidade; gere um segredo aleatório"
    );
  }

  // Um deploy auto-hospedado que esquecia APP_ENV/VERCEL_ENV escapava do bloco
  // inteiro abaixo — TLS obrigatório, rate limit durável, segredo de webhook —
  // sem nenhum aviso. Num build de produção a declaração passa a ser exigida:
  // esquecer agora impede o boot, em vez de destravar a loja sem os controles.
  if (process.env.NODE_ENV === "production" && declaredEnvironment() === null) {
    throw new Error(
      [
        "Configuração de ambiente inválida:",
        "- declare APP_ENV (ou VERCEL_ENV) como production, preview, staging, development ou test",
      ].join("\n"),
    );
  }

  // Em produção, controles essenciais falham fechado. É melhor impedir um
  // deploy inseguro do que iniciar silenciosamente sem TLS/rate limit/webhook.
  // `next build` e `next start` também usam NODE_ENV=production em CI e em
  // homologação. Use o sinal inequívoco do provedor (ou APP_ENV em self-host)
  // para não confundir esses ambientes com a loja realmente pública.
  if (isLiveProduction()) {
    const errors: string[] = [];
    let publicOrigin: string | null = null;
    try {
      const publicUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "");
      if (
        publicUrl.protocol !== "https:" ||
        publicUrl.username ||
        publicUrl.password ||
        (publicUrl.pathname !== "/" && publicUrl.pathname !== "") ||
        publicUrl.search ||
        publicUrl.hash
      ) {
        throw new Error();
      }
      publicOrigin = publicUrl.origin;
    } catch {
      errors.push("NEXT_PUBLIC_BASE_URL deve ser uma URL https:// válida");
    }
    if (process.env.AUTH_URL) {
      try {
        const authOrigin = new URL(process.env.AUTH_URL).origin;
        if (
          !process.env.AUTH_URL.startsWith("https://") ||
          !publicOrigin ||
          authOrigin !== publicOrigin
        ) {
          errors.push("AUTH_URL deve usar o mesmo origin https:// de NEXT_PUBLIC_BASE_URL");
        }
      } catch {
        errors.push("AUTH_URL deve ser uma URL https:// válida");
      }
    }
    const paymentsEnabled = explicitFeatureFlag("PAYMENTS_ENABLED", errors);
    if (paymentsEnabled) {
      if (!/^sk_(?:test|live)_\S{16,}$/.test(process.env.STRIPE_SECRET_KEY ?? "")) {
        errors.push("STRIPE_SECRET_KEY é obrigatória com PAYMENTS_ENABLED=true");
      }
      if (!/^whsec_\S{16,}$/.test(process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
        errors.push("STRIPE_WEBHOOK_SECRET é obrigatória com PAYMENTS_ENABLED=true");
      }
    }
    const emailEnabled = explicitFeatureFlag("EMAIL_ENABLED", errors);
    if (emailEnabled && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)) {
      errors.push("RESEND_API_KEY e MAIL_FROM são obrigatórios com EMAIL_ENABLED=true");
    }
    hasValidDurableRateLimit(errors);
    if (
      !process.env.CRON_SECRET ||
      process.env.CRON_SECRET.length < 32 ||
      PLACEHOLDER_SECRET.test(process.env.CRON_SECRET) ||
      !hasReasonableSecretEntropy(process.env.CRON_SECRET)
    ) {
      errors.push("CRON_SECRET deve ser aleatório e ter ao menos 32 caracteres");
    }
    const storageDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
    if (!storageDriver || !["s3", "local", "disabled"].includes(storageDriver)) {
      errors.push(
        "STORAGE_DRIVER deve ser definido explicitamente como s3, local ou disabled"
      );
    } else if (storageDriver === "local") {
      if (process.env.VERCEL_ENV === "production") {
        errors.push("STORAGE_DRIVER=local não é permitido na Vercel (filesystem efêmero)");
      }
      if (!process.env.UPLOAD_DIR?.trim()) {
        errors.push("UPLOAD_DIR persistente é obrigatório com STORAGE_DRIVER=local");
      }
    } else if (storageDriver === "s3") {
      if (!process.env.S3_BUCKET?.trim()) {
        errors.push("S3_BUCKET é obrigatório com STORAGE_DRIVER=s3");
      }
      const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
      const secretKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
      if (Boolean(accessKey) !== Boolean(secretKey)) {
        errors.push("S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY devem formar um par");
      }
      if (process.env.S3_ENDPOINT) {
        try {
          const endpoint = new URL(process.env.S3_ENDPOINT);
          if (endpoint.protocol !== "https:") throw new Error();
        } catch {
          errors.push("S3_ENDPOINT deve ser uma URL https:// válida");
        }
        if (!accessKey || !secretKey) {
          errors.push("Endpoint S3 compatível exige credenciais explícitas");
        }
      }
    }
    for (const name of ["MFA_ENCRYPTION_KEY", "MFA_RECOVERY_PEPPER"] as const) {
      if (!isStrongRuntimeSecret(process.env[name])) {
        errors.push(`${name} deve ser exclusivo, aleatório e ter ao menos 32 caracteres`);
      }
    }
    if (
      process.env.MFA_ENCRYPTION_KEY === process.env.MFA_RECOVERY_PEPPER ||
      process.env.MFA_ENCRYPTION_KEY === parsed.data.AUTH_SECRET ||
      process.env.MFA_RECOVERY_PEPPER === parsed.data.AUTH_SECRET
    ) {
      errors.push("AUTH_SECRET e os dois segredos MFA devem ser diferentes entre si");
    }
    for (
      const [currentName, previousName] of [
        ["MFA_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY_PREVIOUS"],
        ["MFA_RECOVERY_PEPPER", "MFA_RECOVERY_PEPPER_PREVIOUS"],
      ] as const
    ) {
      const previous = process.env[previousName];
      if (previous && !isStrongRuntimeSecret(previous)) {
        errors.push(`${previousName}, quando definido, deve ser um segredo forte`);
      }
      if (previous && previous === process.env[currentName]) {
        errors.push(`${previousName} deve ser diferente de ${currentName}`);
      }
    }

    try {
      const databaseUrl = new URL(parsed.data.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
        errors.push("DATABASE_URL deve usar PostgreSQL");
      }
      const sslMode = databaseUrl.searchParams.get("sslmode");
      if (!sslMode || !["require", "verify-ca", "verify-full"].includes(sslMode)) {
        errors.push("DATABASE_URL deve exigir TLS com sslmode=require ou mais estrito");
      }
    } catch {
      errors.push("DATABASE_URL não é uma URL válida");
    }
    if (errors.length) {
      throw new Error(
        "Configuração de produção insegura:\n" +
          errors.map((error) => `- ${error}`).join("\n")
      );
    }
  }
}
