"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type AddressState = { ok?: boolean; error?: string } | undefined;

function parse(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    label: s("label") || "Endereço",
    recipient: s("recipient"),
    zip: s("zip"),
    street: s("street"),
    number: s("number"),
    complement: s("complement") || null,
    district: s("district"),
    city: s("city"),
    state: s("state").toUpperCase().slice(0, 2),
    isDefault: fd.get("isDefault") === "on",
  };
}

function validate(d: ReturnType<typeof parse>): string | null {
  if (
    !d.recipient ||
    !d.zip ||
    !d.street ||
    !d.number ||
    !d.district ||
    !d.city ||
    !d.state
  ) {
    return "Preencha todos os campos obrigatórios do endereço.";
  }
  return null;
}

function revalidate() {
  revalidatePath("/conta/enderecos");
  revalidatePath("/checkout");
}

export async function createAddress(
  _prev: AddressState,
  fd: FormData
): Promise<AddressState> {
  const user = await requireUser();
  const d = parse(fd);
  const err = validate(d);
  if (err) return { error: err };

  // O primeiro endereço do cliente vira padrão automaticamente.
  const count = await prisma.address.count({ where: { userId: user.id } });
  const makeDefault = d.isDefault || count === 0;

  await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }
    await tx.address.create({
      data: { ...d, userId: user.id, isDefault: makeDefault },
    });
  });

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

  const d = parse(fd);
  const err = validate(d);
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

  try {
    await prisma.address.delete({ where: { id } });
  } catch {
    // FK: endereço referenciado por pedido (onDelete Restrict).
    return {
      ok: false,
      error: "Este endereço está vinculado a um pedido e não pode ser excluído.",
    };
  }

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
