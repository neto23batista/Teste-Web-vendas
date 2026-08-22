const CONFIRMATION = "I_UNDERSTAND_THIS_WILL_DELETE_DATA";
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type SeedEnvironment = Record<string, string | undefined>;

/**
 * O seed é destrutivo por definição. Ele só pode atingir um PostgreSQL local e
 * exige uma confirmação difícil de acionar por acidente. Não há bypass para
 * hosts remotos: ambientes compartilhados devem usar fixtures não destrutivas.
 */
export function assertDestructiveSeedAllowed(env: SeedEnvironment): void {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("Seed destrutivo bloqueado em ambiente de produção.");
  }

  if (env.ALLOW_DESTRUCTIVE_SEED !== CONFIRMATION) {
    throw new Error(
      `Seed destrutivo bloqueado. Defina ALLOW_DESTRUCTIVE_SEED=${CONFIRMATION} somente para um banco local descartável.`
    );
  }

  // O Prisma Client usado pelo seed conecta pelo `url` do datasource, isto é,
  // DATABASE_URL. Validar outra URL daria uma falsa sensação de segurança.
  const connection = env.DATABASE_URL;
  if (!connection) {
    throw new Error("Seed destrutivo bloqueado: DATABASE_URL não configurada.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connection);
  } catch {
    throw new Error("Seed destrutivo bloqueado: DATABASE_URL inválida.");
  }

  const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !LOCAL_DATABASE_HOSTS.has(hostname)
  ) {
    throw new Error(
      `Seed destrutivo bloqueado para host não local (${databaseUrl.hostname || "desconhecido"}).`
    );
  }
}

export const DESTRUCTIVE_SEED_CONFIRMATION = CONFIRMATION;
