import { Prisma } from "@prisma/client";

/**
 * Ordem canônica de aquisição de lock para operações multi-produto.
 *
 * Dois checkouts com os mesmos itens em ordens diferentes travavam as linhas de
 * `Inventory` em sequências opostas, e o PostgreSQL abortava um deles por
 * deadlock. Qualquer fluxo que toque mais de um produto na mesma transação
 * precisa percorrer os itens por esta ordem — reserva, liberação, transferência
 * e os caminhos legados de baixa e devolução.
 *
 * Itens sem produto vinculado vão para o fim: eles não travam linha nenhuma, e
 * mantê-los no meio embaralharia a ordem dos que travam.
 */
export function inLockOrder<T extends { productId: string | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.productId === b.productId) return 0;
    if (a.productId === null) return 1;
    if (b.productId === null) return -1;
    return a.productId < b.productId ? -1 : 1;
  });
}

/**
 * Conflito de escrita ou deadlock detectado pelo PostgreSQL (40001 / 40P01).
 * O Prisma traduz para P2034 nas transações interativas, mas o código bruto
 * ainda aparece em erros não mapeados — os dois formatos contam.
 */
function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.includes("40001") || message.includes("40P01");
}

/**
 * Repete uma transação que o banco abortou por conflito de escrita.
 *
 * Deadlock e falha de serialização são a forma de o PostgreSQL dizer "tente de
 * novo": a transação inteira voltou, então repetir não duplica efeito. Só vale
 * para operações que já são idempotentes ou que reconstroem o próprio estado —
 * NUNCA envolva aqui uma chamada a provedor externo.
 *
 * O limite é baixo de propósito: se três tentativas não passam, o problema não é
 * concorrência pontual e mascarar isso com espera longa só piora a latência.
 */
export async function withWriteConflictRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 40 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      lastError = error;
      if (attempt < attempts - 1) {
        // Espera crescente com ruído: duas transações que colidiram não devem
        // voltar juntas e colidir de novo no mesmo instante.
        const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * baseDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
