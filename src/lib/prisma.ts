import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reutiliza a mesma instância em todos os ambientes (evita múltiplos clients
// no hot-reload do dev e em workers de longa duração).
// Em serverless (ex.: Vercel), limite as conexões via `?connection_limit=` na
// DATABASE_URL ou use Prisma Accelerate.
globalForPrisma.prisma = prisma;
