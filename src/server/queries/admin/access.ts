import "server-only";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminScope, requireArea } from "@/lib/auth/session";
import { getStoreSettings, getPaymentSettings } from "@/lib/settings";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { moneyToNumber } from "@/lib/money";

/** Configuração editável e presença de credenciais; nunca retorna segredos. */
export async function getAdminSettingsView() {
  const user = await requireArea("configuracoes");
  const [settings, payment, scope] = await Promise.all([
    getStoreSettings(), getPaymentSettings(), getAdminScope(),
  ]);
  // Gestão de unidades só para a matriz (escopo global).
  const [units, admins] = scope.isGlobal
    ? await Promise.all([
        prisma.pharmacy.findMany({
          orderBy: [{ type: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            active: true,
            archivedAt: true,
            city: true,
            state: true,
            shippingFlat: true,
            shippingFreeMin: true,
            cnpj: true,
            pharmacistName: true,
            pharmacistCrf: true,
            cepRanges: {
              where: { archivedAt: null },
              orderBy: { start: "asc" },
              select: { id: true, start: true, end: true, km: true },
            },
          },
        }),
        prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true, name: true, email: true, pharmacyId: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return {
    settings,
    paymentView: {
      hasSecretKey: payment.stripeSecretKey.length > 0,
      hasWebhook: payment.stripeWebhookSecret.length > 0,
    },
    isGlobal: scope.isGlobal,
    units: units.map((unit) => ({
      ...unit,
      archivedAt: unit.archivedAt?.toISOString() ?? null,
      shippingFlat: unit.shippingFlat == null ? null : moneyToNumber(unit.shippingFlat),
      shippingFreeMin: unit.shippingFreeMin == null ? null : moneyToNumber(unit.shippingFreeMin),
    })),
    admins,
    currentUserId: user.id,
  };
}

export async function getAdminTeamView() {
  const me = await requireArea("equipe");
  const [staff, pharmacies] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ staffProfile: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true, staffProfile: true,
        pharmacy: { select: { name: true } },
      },
    }),
    listPharmaciesSafe(),
  ]);
  return {
    rows: staff.map((member) => ({
      id: member.id, name: member.name, email: member.email,
      staffProfile: member.staffProfile, pharmacyName: member.pharmacy?.name ?? null,
      isSelf: member.id === me.id,
    })),
    pharmacies: pharmacies.map(({ id, name }) => ({ id, name })),
  };
}

export async function getAdminAuditView() {
  await requireArea("auditoria");
  const scope = await getAdminScope();
  if (!scope.isGlobal) redirect("/admin");
  // Apenas a ausência de tabela/coluna pré-migration é tolerada.
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" }, take: 200,
    select: {
      id: true, createdAt: true, userEmail: true, action: true,
      detail: true, entity: true, entityId: true,
    },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")) return [];
    throw error;
  });
}
