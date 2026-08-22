"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertOwner } from "@/lib/session";
import { logAudit } from "@/lib/audit";
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
  const expires = String(formData.get("expiresAt") ?? "").trim();
  const minTotalRaw = String(formData.get("minTotal") ?? "").trim();
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    type: (String(formData.get("type") ?? "PERCENT") as CouponType),
    valueCents: parseMoneyInputToCents(String(formData.get("value") ?? "")),
    minTotalCents:
      minTotalRaw === "" ? 0 : parseMoneyInputToCents(minTotalRaw),
    usageLimit,
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
  return null;
}

export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await assertMatrixOwner();
  const d = parse(formData);
  const err = validate(d);
  if (err) return { error: err };

  const exists = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (exists) return { error: "Já existe um cupom com esse código." };

  const created = await prisma.coupon.create({
    data: {
      code: d.code,
      type: d.type,
      value: centsToDecimal(d.valueCents!),
      minTotal: centsToDecimal(d.minTotalCents!),
      usageLimit: d.usageLimit,
      expiresAt: d.expiresAt,
      active: d.active,
    },
  });

  await logAudit({
    action: "coupon.create",
    entity: "Coupon",
    entityId: created.id,
    detail: `Criou o cupom "${d.code}" (${couponValueLabel(d.type, d.valueCents!)})`,
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function updateCoupon(
  id: string,
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await assertMatrixOwner();
  const d = parse(formData);
  const err = validate(d);
  if (err) return { error: err };

  const other = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (other && other.id !== id) {
    return { error: "Já existe um cupom com esse código." };
  }

  await prisma.coupon.update({
    where: { id },
    data: {
      code: d.code,
      type: d.type,
      value: centsToDecimal(d.valueCents!),
      minTotal: centsToDecimal(d.minTotalCents!),
      usageLimit: d.usageLimit,
      expiresAt: d.expiresAt,
      active: d.active,
    },
  });

  await logAudit({
    action: "coupon.update",
    entity: "Coupon",
    entityId: id,
    detail: `Editou o cupom "${d.code}" (${couponValueLabel(d.type, d.valueCents!)})`,
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function toggleCoupon(id: string) {
  await assertMatrixOwner();
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (coupon) {
    await prisma.coupon.update({ where: { id }, data: { active: !coupon.active } });
    await logAudit({
      action: "coupon.toggle",
      entity: "Coupon",
      entityId: id,
      detail: `${coupon.active ? "Desativou" : "Ativou"} o cupom "${coupon.code}"`,
    });
    revalidatePath("/admin/cupons");
  }
  return { ok: true };
}

export async function deleteCoupon(id: string) {
  await assertMatrixOwner();
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { code: true },
  });
  // Só registra na auditoria (e reporta sucesso) se o delete de fato ocorreu.
  const deleted = await prisma.coupon
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await logAudit({
      action: "coupon.delete",
      entity: "Coupon",
      entityId: id,
      detail: `Excluiu o cupom "${coupon?.code ?? id}"`,
    });
    revalidatePath("/admin/cupons");
  }
  return { ok: deleted };
}
