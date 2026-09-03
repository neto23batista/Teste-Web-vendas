import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";

/**
 * Garante que só uma execução de um job periódico trabalhe por vez.
 *
 * Com o cron rodando de hora em hora, uma execução lenta ainda está no ar quando
 * a próxima começa — e duas passadas simultâneas sobre a mesma fila consultam o
 * provedor em dobro e disputam as mesmas linhas. Um lock de sessão do PostgreSQL
 * não serve aqui: o pool serverless devolve a conexão entre as consultas e o
 * lock morre junto.
 *
 * A lease tem prazo. Se o processo morrer no meio (timeout da função, deploy),
 * ninguém fica preso: a próxima execução depois do vencimento simplesmente toma
 * a lease de volta. Por isso o TTL deve ser um pouco maior que o tempo máximo
 * esperado do job, e nunca maior que o intervalo entre execuções.
 */
export async function withJobLease<T>(
  name: string,
  ttlMs: number,
  run: () => Promise<T>,
): Promise<{ ran: true; result: T } | { ran: false }> {
  const holder = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Toma uma lease vencida (ou nunca liberada). O UPDATE condicional é a
  // arbitragem: só uma execução consegue count === 1.
  const taken = await prisma.jobLease.updateMany({
    where: { name, expiresAt: { lte: now } },
    data: { holder, acquiredAt: now, expiresAt },
  });

  if (taken.count !== 1) {
    try {
      await prisma.jobLease.create({ data: { name, holder, expiresAt } });
    } catch (error) {
      // P2002: a linha já existe e está viva — outra execução está trabalhando.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ran: false };
      }
      throw error;
    }
  }

  try {
    return { ran: true, result: await run() };
  } finally {
    // Libera antes do prazo para que a próxima execução não precise esperar o
    // TTL inteiro. Best-effort: se falhar, o vencimento resolve sozinho.
    await prisma.jobLease
      .updateMany({ where: { name, holder }, data: { expiresAt: new Date() } })
      .catch((error) => {
        reportError(error, { operation: "job.lease.release", job: name });
      });
  }
}
