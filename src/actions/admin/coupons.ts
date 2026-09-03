"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertOwner } from "@/lib/auth/session";
import { logAuditInTransaction } from "@/lib/audit";
import type { CouponType } from "@prisma/client";
import { centsToDecimal, parseMoneyInputToCents } from "@/lib/money";

/** Descrição curta do desconto para a trilha de auditoria (ex.: "10%", "R$ 15"). */
function couponValueLabel(type: CouponType, valueCents: number): string {
  const value = centsToDecimal(valueCents).replace(".", ",");
  return type === "PERCENT" ? `${value}%` : `R$ ${value}`;
}

export type CouponFormState = { error?: string } | undefined;

async function assertMatrixOwner() {
  const owner = await assertOwner();
  if (owner.pharmacyType !== "MATRIZ") {
    throw new Error("Apenas o dono/gerente da matriz pode alterar cupons globais.");
  }
  return owner;
}

function parse(formData: FormData) {
  const rawUsage = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = rawUsage === "" ? null : Number(rawUsage);
  const usageLimitPerCustomer = Number(
    String(formData.get("usageLimitPerCustomer") ?? "1").trim()
  );
  const expires = String(formData.get("expiresAt") ?? "").trim();
  const minTotalRaw = String(formData.get("minTotal") ?? "").trim();
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    type: (String(formData.get("type") ?? "PERCENT") as CouponType),
    valueCents: parseMoneyInputToCents(String(formData.get("value") ?? "")),
    minTotalCents:
      minTotalRaw === "" ? 0 : parseMoneyInputToCents(minTotalRaw),
    usageLimit,
    usageLimitPerCustomer,
    expiresAt: expires ? new Date(`${expires}T23:59:59`) : null,
    active: formData.get("active") === "on",
  };
}

function validate(d: ReturnType<typeof parse>): string | null {
  if (!d.code) return "Informe o código do cupom.";
  if (!/^[A-Z0-9]{3,20}$/.test(d.code))
    return "Código deve ter 3 a 20 letras/números, sem espaços.";
  if (d.valueCents === null || d.valueCents <= 0)
    return "Informe um valor maior que zero, com até 2 casas decimais.";
  if (d.minTotalCents === null || d.minTotalCents < 0) {
    return "A compra mínima é inválida; use até 2 casas decimais.";
  }
  if (d.type === "PERCENT" && d.valueCents > 9_000)
    return "Desconto percentual não pode passar de 90%.";
  if (
    d.usageLimit !== null &&
    (!Number.isSafeInteger(d.usageLimit) || d.usageLimit <= 0)
  ) {
    return "O limite de usos deve ser um inteiro positivo.";
  }
  if (!Number.isSafeInteger(d.usageLimitPerCustomer) || d.usageLimitPerCustomer <= 0) {
    return "O limite por cliente deve ser um inteiro positivo.";
  }
  return null;
}

export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  const actor = await assertMatrixOwner();
  const d = parse(formData);
  const err = validate(d);
  if (err) return { error: err };

  const exists = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (exists) return { error: "Já existe um cupom com esse código." };

  await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        code: d.code,
        type: d.type,
        value: centsToDecimal(d.valueCents!),
        minTotal: centsToDecimal(d.minTotalCents!),
        usageLimit: d.usageLimit,
        usageLimitPerCustomer: d.usageLimitPerCustomer,
        expiresAt: d.expiresAt,
        active: d.active,
      },
    });
    await logAuditInTransaction(tx, {
      action: "coupon.create",
      entity: "Coupon",
      entityId: coupon.id,
      detail: `Criou o cupom "${d.code}" (${couponValueLabel(d.type, d.valueCents!)})`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
    return coupon;
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function updateCoupon(
  id: string,
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  const actor = await assertMatrixOwner();
  const d = parse(formData);
  const err = validate(d);
  if (err) return { error: err };

  const other = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (other && other.id !== id) {
    return { error: "Já existe um cupom com esse código." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id },
      data: {
        code: d.code,
        type: d.type,
        value: centsToDecimal(d.valueCents!),
        minTotal: centsToDecimal(d.minTotalCents!),
        usageLimit: d.usageLimit,
        usageLimitPerCustomer: d.usageLimitPerCustomer,
        expiresAt: d.expiresAt,
        active: d.active,
      },
    });
    await logAuditInTransaction(tx, {
      action: "coupon.update",
      entity: "Coupon",
      entityId: id,
      detail: `Editou o cupom "${d.code}" (${couponValueLabel(d.type, d.valueCents!)})`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function toggleCoupon(id: string) {
  const actor = await assertMatrixOwner();
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (coupon) {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id }, data: { active: !coupon.active } });
      await logAuditInTransaction(tx, {
        action: "coupon.toggle",
        entity: "Coupon",
        entityId: id,
        detail: `${coupon.active ? "Desativou" : "Ativou"} o cupom "${coupon.code}"`,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
    revalidatePath("/admin/cupons");
  }
  return { ok: true };
}

export async function deleteCoupon(id: string) {
  const actor = await assertMatrixOwner();
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { code: true },
  });
  // Só registra na auditoria (e reporta sucesso) se o delete de fato ocorreu —
  // no mesmo commit, para não existir exclusão sem evidência.
  const deleted = await prisma
    .$transaction(async (tx) => {
      await tx.coupon.delete({ where: { id } });
      await logAuditInTransaction(tx, {
        action: "coupon.delete",
        entity: "Coupon",
        entityId: id,
        detail: `Excluiu o cupom "${coupon?.code ?? id}"`,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
      return true;
    })
    .catch(() => false);
  if (deleted) {
    revalidatePath("/admin/cupons");
  }
  return { ok: deleted };
}
