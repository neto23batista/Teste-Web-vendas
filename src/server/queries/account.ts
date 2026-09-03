import "server-only";

import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth/session";
import { isLiveProduction } from "@/lib/env";
import { dataExportStateSchema } from "@/contracts/account";

export async function getAddressBookView() {
  const user = await requireUserPage("/conta/enderecos");
  return prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, label: true, recipient: true, zip: true, street: true,
      number: true, complement: true, district: true, city: true,
      state: true, isDefault: true,
    },
  });
}

export async function getAccountSecurityView() {
  const user = await requireUserPage("/conta/seguranca");
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, mfaEnabledAt: true },
  });
  if (!current) return null;
  return {
    isAdmin: current.role === "ADMIN",
    mfaEnabled: Boolean(current.mfaEnabledAt),
    liveProduction: isLiveProduction(),
  };
}

export async function getAccountPrivacyView() {
  const user = await requireUserPage("/conta/privacidade");
  const [latestExport, legacyDocuments] = await Promise.all([
    prisma.dataExportRequest.findFirst({
      where: { userId: user.id },
      orderBy: { requestedAt: "desc" },
      select: {
        status: true, sizeBytes: true, requestedAt: true,
        readyAt: true, expiresAt: true,
      },
    }),
    prisma.prescription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, order: { select: { number: true } } },
    }),
  ]);
  // Erros internos do job ficam nos logs; a conta recebe apenas orientação segura.
  const exportState = dataExportStateSchema.parse(!latestExport
    ? { status: "NONE" }
    : latestExport.status === "READY" && latestExport.readyAt && latestExport.expiresAt
      ? latestExport.expiresAt.getTime() <= Date.now()
        ? { status: "EXPIRED", error: null }
        : {
            status: "READY", readyAt: latestExport.readyAt.toISOString(),
            expiresAt: latestExport.expiresAt.toISOString(), sizeBytes: latestExport.sizeBytes,
          }
      : latestExport.status === "PENDING"
        ? { status: "PENDING", requestedAt: latestExport.requestedAt.toISOString() }
        : {
            status: latestExport.status === "EXPIRED" ? "EXPIRED" : "FAILED",
            error: latestExport.status === "EXPIRED" ? null : "Não foi possível preparar o arquivo. Solicite uma nova exportação.",
          });
  return { email: user.email ?? "", exportState, legacyDocuments };
}
