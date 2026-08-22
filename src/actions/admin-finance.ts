"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertArea,
  assertOwner,
  getAdminScope,
  requireAdminAtPharmacy,
} from "@/lib/session";
import { logAuditInTransaction } from "@/lib/audit";
import { parseStatement, matchStatement } from "@/lib/ofx";
import {
  centsToDecimal,
  moneyToCents,
  parseMoneyInputToCents,
} from "@/lib/money";

const CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "PAYROLL",
  "SUPPLIER",
  "MARKETING",
  "TAX",
  "UTILITIES",
  "OTHER",
];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ─────────────────────────── Despesas ───────────────────────────

/** Lança uma despesa operacional (entra na DRE e no fluxo de caixa). */
export async function createExpense(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const actor = await assertArea("financeiro");
  const scope = await getAdminScope();

  const description = str(formData, "description");
  const category = str(formData, "category") as ExpenseCategory;
  const requestedPharmacyId = str(formData, "pharmacyId") || null;
  const pharmacyId = scope.isGlobal ? requestedPharmacyId : scope.pharmacyId;
  const amountCents = parseMoneyInputToCents(
    str(formData, "amount").replace(/\./g, "")
  );
  const paidAt = new Date(`${str(formData, "paidAt")}T12:00:00`);

  if (description.length < 3) return { ok: false, error: "Descreva a despesa." };
  if (!CATEGORIES.includes(category)) return { ok: false, error: "Categoria inválida." };
  if (amountCents === null || amountCents <= 0) {
    return { ok: false, error: "Informe um valor válido." };
  }
  if (Number.isNaN(paidAt.getTime())) return { ok: false, error: "Informe a data." };
  if (pharmacyId) await requireAdminAtPharmacy(pharmacyId);

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        description,
        category,
        amount: centsToDecimal(amountCents),
        paidAt,
        pharmacyId,
      },
      select: { id: true },
    });
    await logAuditInTransaction(tx, {
      action: "expense.create",
      entity: "Expense",
      entityId: expense.id,
      detail: `Registrou despesa operacional na categoria ${category}`,
      pharmacyId,
      actor: { id: actor.id, email: actor.email ?? null },
    });
  });
  revalidatePath("/admin/financeiro");
  return { ok: true };
}

export async function deleteExpense(
  expenseId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await assertArea("financeiro");
  const scope = await getAdminScope();
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, error: "Despesa não encontrada." };
  if (expense.pharmacyId) {
    await requireAdminAtPharmacy(expense.pharmacyId);
  } else if (!scope.isGlobal) {
    return { ok: false, error: "Sem permissão para esta despesa." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } });
    await logAuditInTransaction(tx, {
      action: "expense.delete",
      entity: "Expense",
      entityId: expenseId,
      detail: "Removeu despesa operacional",
      pharmacyId: expense.pharmacyId,
      actor: { id: actor.id, email: actor.email ?? null },
    });
  });
  revalidatePath("/admin/financeiro");
  return { ok: true };
}

// ─────────────────── Conciliação bancária (extrato) ───────────────────

export type ImportStatementResult = {
  ok: boolean;
  error?: string;
  /** Lançamentos novos gravados. */
  imported: number;
  /** Já existiam (mesmo identificador) — ignorados. */
  duplicated: number;
  /** Casados automaticamente com pagamentos do sistema. */
  matched: number;
};

const fail = (error: string): ImportStatementResult => ({
  ok: false,
  error,
  imported: 0,
  duplicated: 0,
  matched: 0,
});

/**
 * Importa um extrato bancário (OFX ou CSV) e concilia automaticamente:
 * cada crédito do extrato com mesmo valor (±R$ 0,01) e data próxima (±3 dias)
 * de um pagamento aprovado ainda não conciliado é casado com ele.
 */
export async function importStatement(
  formData: FormData
): Promise<ImportStatementResult> {
  const actor = await assertOwner();
  const scope = await getAdminScope();
  if (!scope.isGlobal) {
    return fail("A conciliação bancária global é restrita à matriz.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Selecione o arquivo do extrato (OFX ou CSV).");
  }
  if (file.size > 2 * 1024 * 1024) return fail("Arquivo muito grande (máx. 2 MB).");

  const txs = parseStatement(await file.text());
  if (txs.length === 0) {
    return fail(
      "Nenhum lançamento reconhecido — o arquivo precisa ser um OFX do banco ou um CSV com colunas de data e valor."
    );
  }
  if (
    txs.some(
      (tx) => moneyToCents(tx.amount, { allowNegative: true }) === null
    )
  ) {
    return fail("O extrato contém valor monetário fora do limite aceito.");
  }

  const statementDecimal = (amount: number) =>
    centsToDecimal(moneyToCents(amount, { allowNegative: true })!);

  // Dedupe: por identificador (FITID) quando houver; sem identificador, por
  // data + valor + descrição (evita duplicar reimportando o mesmo período).
  const withId = txs.filter((t) => t.externalId);
  const existingIds = new Set(
    (
      await prisma.bankTransaction.findMany({
        where: { externalId: { in: withId.map((t) => t.externalId!) } },
        select: { externalId: true },
      })
    ).map((t) => t.externalId)
  );

  let duplicated = 0;
  const fresh: typeof txs = [];
  for (const t of txs) {
    if (t.externalId) {
      if (existingIds.has(t.externalId)) duplicated++;
      else fresh.push(t);
    } else {
      const dup = await prisma.bankTransaction.findFirst({
        where: {
          externalId: null,
          date: new Date(`${t.date}T12:00:00`),
          amount: statementDecimal(t.amount),
          description: t.description,
        },
        select: { id: true },
      });
      if (dup) duplicated++;
      else fresh.push(t);
    }
  }

  const matched = await prisma.$transaction(
    async (tx) => {
      if (fresh.length > 0) {
        await tx.bankTransaction.createMany({
          data: fresh.map((t) => ({
            externalId: t.externalId,
            date: new Date(`${t.date}T12:00:00`),
            description: t.description,
            amount: statementDecimal(t.amount),
          })),
          skipDuplicates: true,
        });
      }

      // Conciliação: créditos ainda sem pagamento × pagamentos aprovados.
      const pending = await tx.bankTransaction.findMany({
        where: { paymentId: null, amount: { gt: 0 } },
        select: {
          id: true,
          externalId: true,
          date: true,
          description: true,
          amount: true,
        },
        orderBy: { date: "asc" },
        take: 1000,
      });
      const candidates = await tx.payment.findMany({
        where: { status: "APPROVED", bankTx: null },
        select: { id: true, amount: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      });

      const matches = matchStatement(
        pending.map((statement) => ({
          externalId: statement.externalId,
          date: statement.date.toISOString().slice(0, 10),
          description: statement.description,
          amount: statement.amount,
        })),
        candidates.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          date: payment.updatedAt.toISOString().slice(0, 10),
        }))
      );

      await Promise.all(
        [...matches].map(([txIndex, paymentId]) =>
          tx.bankTransaction.update({
            where: { id: pending[txIndex].id },
            data: { paymentId },
          })
        )
      );

      await logAuditInTransaction(tx, {
        action: "finance.import",
        entity: "BankTransaction",
        detail: `Importou ${fresh.length} lançamentos e conciliou ${matches.size}`,
        actor: { id: actor.id, email: actor.email ?? null },
      });
      return matches.size;
    },
    { maxWait: 5_000, timeout: 30_000 }
  );
  revalidatePath("/admin/financeiro");
  return { ok: true, imported: fresh.length, duplicated, matched };
}
