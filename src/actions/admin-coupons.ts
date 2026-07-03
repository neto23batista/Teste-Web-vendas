"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import type { CouponType } from "@prisma/client";

/** Descrição curta do desconto para a trilha de auditoria (ex.: "10%", "R$ 15"). */
function couponValueLabel(type: CouponType, value: number): string {
  return type === "PERCENT" ? `${value}%` : `R$ ${value}`;
}

export type CouponFormState = { error?: string } | undefined;

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  const expires = String(formData.get("expiresAt") ?? "").trim();
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    type: (String(formData.get("type") ?? "PERCENT") as CouponType),
    value: num("value"),
    minTotal: num("minTotal") ?? 0,
    usageLimit: num("usageLimit"),
    expiresAt: expires ? new Date(`${expires}T23:59:59`) : null,
    active: formData.get("active") === "on",
  };
}

function validate(d: ReturnType<typeof parse>): string | null {
  if (!d.code) return "Informe o código do cupom.";
  if (!/^[A-Z0-9]{3,20}$/.test(d.code))
    return "Código deve ter 3 a 20 letras/números, sem espaços.";
  if (d.value === null || d.value <= 0) return "Informe um valor maior que zero.";
  if (d.type === "PERCENT" && d.value > 90)
    return "Desconto percentual não pode passar de 90%.";
  return null;
}

export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await requireAdmin();
  const d = parse(formData);
  const err = validate(d);
  if (err) return { error: err };

  const exists = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (exists) return { error: "Já existe um cupom com esse código." };

  const created = await prisma.coupon.create({
    data: {
      code: d.code,
      type: d.type,
      value: d.value!,
      minTotal: d.minTotal,
      usageLimit: d.usageLimit,
      expiresAt: d.expiresAt,
      active: d.active,
    },
  });

  await logAudit({
    action: "coupon.create",
    entity: "Coupon",
    entityId: created.id,
    detail: `Criou o cupom "${d.code}" (${couponValueLabel(d.type, d.value!)})`,
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function updateCoupon(
  id: string,
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  await requireAdmin();
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
      value: d.value!,
      minTotal: d.minTotal,
      usageLimit: d.usageLimit,
      expiresAt: d.expiresAt,
      active: d.active,
    },
  });

  await logAudit({
    action: "coupon.update",
    entity: "Coupon",
    entityId: id,
    detail: `Editou o cupom "${d.code}" (${couponValueLabel(d.type, d.value!)})`,
  });
  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function toggleCoupon(id: string) {
  await requireAdmin();
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
  await requireAdmin();
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
