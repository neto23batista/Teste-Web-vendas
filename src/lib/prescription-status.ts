import type { PrescriptionStatus } from "@prisma/client";

// Fonte única dos rótulos de status de receita (badge do admin + auditoria).
export const PRESCRIPTION_STATUS_LABEL: Record<PrescriptionStatus, string> = {
  PENDING: "Em análise",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
};
