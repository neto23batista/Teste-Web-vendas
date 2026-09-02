import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MAX_USER_ADDRESSES,
  type NormalizedAddress,
} from "@/lib/shipping/address";

export type CreateUserAddressResult =
  | { ok: true; address: Awaited<ReturnType<typeof createAddressRecord>> }
  | { ok: false; reason: "limit" };

type AddressTransaction = Prisma.TransactionClient;

function createAddressRecord(
  tx: AddressTransaction,
  userId: string,
  address: NormalizedAddress,
  isDefault: boolean
) {
  return tx.address.create({
    data: { ...address, userId, isDefault },
  });
}

/**
 * Serializa cadastros por usuário para o teto de 20 não sofrer a corrida
 * count-then-create entre a agenda de endereços e o checkout.
 */
export async function createUserAddressWithinLimit(
  userId: string,
  address: NormalizedAddress
): Promise<CreateUserAddressResult> {
  return prisma.$transaction(async (tx) => {
    // A query é parametrizada pelo tagged template do Prisma. O lock dura
    // apenas até o fim desta transação e é compartilhado pelos dois fluxos.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))
    `;

    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_USER_ADDRESSES) {
      return { ok: false as const, reason: "limit" as const };
    }

    const isDefault = address.isDefault || count === 0;
    if (isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const created = await createAddressRecord(tx, userId, address, isDefault);
    return { ok: true as const, address: created };
  });
}
