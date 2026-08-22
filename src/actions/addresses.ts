"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  addressFromFormData,
  validateAddress,
} from "@/lib/address";
import { createUserAddressWithinLimit } from "@/lib/address-persistence";

export type AddressState = { ok?: boolean; error?: string } | undefined;

function revalidate() {
  revalidatePath("/conta/enderecos");
  revalidatePath("/checkout");
}

export async function createAddress(
  _prev: AddressState,
  fd: FormData
): Promise<AddressState> {
  const user = await requireUser();
  const d = addressFromFormData(fd);
  const err = validateAddress(d);
  if (err) return { error: err };

  // O lock transacional compartilhado com o checkout fecha a corrida do teto.
  const result = await createUserAddressWithinLimit(user.id, d);
  if (!result.ok) {
    return { error: "Limite de 20 endereços atingido. Remova um endereço antigo." };
  }

  revalidate();
  return { ok: true };
}

export async function updateAddress(
  id: string,
  _prev: AddressState,
  fd: FormData
): Promise<AddressState> {
  const user = await requireUser();
  const owns = await prisma.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owns) return { error: "Endereço não encontrado." };

  const d = addressFromFormData(fd);
  const err = validateAddress(d);
  if (err) return { error: err };

  await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }
    await tx.address.update({ where: { id }, data: d });
  });

  revalidate();
  return { ok: true };
}

export async function deleteAddress(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const addr = await prisma.address.findFirst({
    where: { id, userId: user.id },
  });
  if (!addr) return { ok: false, error: "Endereço não encontrado." };

  // Pedidos preservam o destino em snapshot; a FK opcional vira null.
  await prisma.address.delete({ where: { id } });

  // Se o excluído era o padrão, promove o mais antigo restante.
  if (addr.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidate();
  return { ok: true };
}

export async function setDefaultAddress(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const owns = await prisma.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owns) return { ok: false, error: "Endereço não encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
    await tx.address.update({ where: { id }, data: { isDefault: true } });
  });

  revalidate();
  return { ok: true };
}
