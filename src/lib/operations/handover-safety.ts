const HANDOVER_CONFIRMATION =
  "I_UNDERSTAND_THIS_WILL_PERMANENTLY_DELETE_DATABASE_DATA";
const REMOTE_CONFIRMATION =
  "I_UNDERSTAND_THIS_REMOTE_DATABASE_WILL_BE_DESTROYED";
const PRINT_PASSWORD_CONFIRMATION =
  "I_ACCEPT_EXPOSING_THE_INITIAL_PASSWORD_TO_THIS_TERMINAL";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const WEAK_PASSWORD_MARKERS =
  /(password|senha|change|troque|example|exemplo|admin|farmavida|qwerty|123456)/i;

export type HandoverEnvironment = Record<string, string | undefined>;

/**
 * Limite inferior do espaço de busca indicado pela forma do segredo. Isso não
 * prova aleatoriedade; por isso o runbook também exige geração CSPRNG em um
 * secret manager. Hexadecimal usa seu alfabeto real de 16 símbolos.
 */
function estimatedPasswordBits(value: string): number {
  if (/^[a-f0-9]+$/i.test(value)) return value.length * 4;

  let alphabetSize = 0;
  if (/[a-z]/.test(value)) alphabetSize += 26;
  if (/[A-Z]/.test(value)) alphabetSize += 26;
  if (/[0-9]/.test(value)) alphabetSize += 10;
  if (/[^A-Za-z0-9]/.test(value)) alphabetSize += 32;
  return alphabetSize > 1 ? value.length * Math.log2(alphabetSize) : 0;
}

function passwordClassCount(value: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(value)
  ).length;
}

function suppliedPasswordIsStrong(value: string): boolean {
  if (
    value.length < 24 ||
    value.length > 256 ||
    !/^[\x21-\x7e]+$/.test(value) ||
    WEAK_PASSWORD_MARKERS.test(value)
  ) {
    return false;
  }

  const distinctCharacters = new Set(value).size;
  const isHex = /^[a-f0-9]+$/i.test(value);
  if (isHex) {
    return (
      value.length >= 32 &&
      distinctCharacters >= 10 &&
      estimatedPasswordBits(value) >= 128
    );
  }

  return (
    passwordClassCount(value) >= 3 &&
    distinctCharacters >= 12 &&
    estimatedPasswordBits(value) >= 128
  );
}

/**
 * Bloqueia a limpeza de handover por padrão. O utilitário é destrutivo e não
 * pode rodar em produção/Vercel; bancos remotos de homologação exigem uma
 * confirmação adicional, diferente da confirmação geral.
 */
export function assertHandoverCleanupAllowed(env: HandoverEnvironment): void {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.APP_ENV === "production" ||
    Boolean(env.VERCEL)
  ) {
    throw new Error("Handover destrutivo bloqueado em ambiente live/Vercel.");
  }

  if (env.ALLOW_DESTRUCTIVE_HANDOVER !== HANDOVER_CONFIRMATION) {
    throw new Error(
      `Handover destrutivo bloqueado. Defina ALLOW_DESTRUCTIVE_HANDOVER=${HANDOVER_CONFIRMATION} somente após conferir o alvo.`
    );
  }

  if (!env.DATABASE_URL) {
    throw new Error("Handover destrutivo bloqueado: DATABASE_URL não configurada.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("Handover destrutivo bloqueado: DATABASE_URL inválida.");
  }

  const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("Handover destrutivo bloqueado: use somente PostgreSQL.");
  }

  if (
    !LOCAL_DATABASE_HOSTS.has(hostname) &&
    env.ALLOW_REMOTE_DESTRUCTIVE_HANDOVER !== REMOTE_CONFIRMATION
  ) {
    throw new Error(
      `Handover bloqueado para banco remoto (${databaseUrl.hostname}). A confirmação remota separada está ausente.`
    );
  }
}

/**
 * A senha deve vir de um canal secreto. Gerar e imprimir só é permitido com
 * opt-in explícito; o chamador então usa 24 bytes aleatórios (192 bits).
 */
export function handoverPasswordMode(
  env: HandoverEnvironment
): "provided" | "generate-and-print" {
  const supplied = env.HANDOVER_OWNER_PASSWORD;
  if (supplied) {
    if (!suppliedPasswordIsStrong(supplied)) {
      throw new Error(
        "HANDOVER_OWNER_PASSWORD é fraca; use um segredo CSPRNG ASCII com forma equivalente a pelo menos 128 bits."
      );
    }
    return "provided";
  }

  if (env.HANDOVER_PRINT_INITIAL_PASSWORD === PRINT_PASSWORD_CONFIRMATION) {
    return "generate-and-print";
  }

  throw new Error(
    "Defina HANDOVER_OWNER_PASSWORD por canal secreto. Para gerar e exibir uma senha uma única vez, confirme explicitamente HANDOVER_PRINT_INITIAL_PASSWORD."
  );
}

export const HANDOVER_SAFETY_CONFIRMATIONS = {
  destructive: HANDOVER_CONFIRMATION,
  remote: REMOTE_CONFIRMATION,
  printPassword: PRINT_PASSWORD_CONFIRMATION,
} as const;
