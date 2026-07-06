import { PrismaClient } from "@prisma/client";

/**
 * URL de conexão da aplicação. O Neon serve através de um POOLER (pgbouncer, host
 * "-pooler") em modo transação. Nesse modo:
 *  - `pgbouncer=true` é OBRIGATÓRIO: desliga os prepared statements do Prisma.
 *    Sem isso, sob concorrência de várias instâncias serverless (Vercel) que
 *    compartilham as conexões de backend do pooler, os prepared statements
 *    colidem → erro intermitente "prepared statement already exists" → 500
 *    aleatório (a página estoura no error boundary). Não reproduz local (1 só
 *    cliente/pool), só sob carga real com múltiplas instâncias.
 *  - `connection_limit=1`: cada instância serverless abre seu próprio pool; sem
 *    limite, muitas instâncias esgotam as conexões do pooler.
 * Só ajusta quando é o pooler; a conexão DIRETA (migrations, directUrl) não muda.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.hostname.includes("-pooler")) return raw; // conexão direta: intacta
    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    return url.toString();
  } catch {
    return raw; // URL não-parseável: deixa o Prisma lidar/falhar com clareza
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: connectionUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reutiliza a mesma instância em todos os ambientes (evita múltiplos clients
// no hot-reload do dev e em workers de longa duração).
globalForPrisma.prisma = prisma;
