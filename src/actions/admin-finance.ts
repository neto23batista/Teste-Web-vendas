"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseStatement, matchStatement } from "@/lib/ofx";

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
  await assertArea("financeiro");

  const description = str(formData, "description");
  const category = str(formData, "category") as ExpenseCategory;
  const pharmacyId = str(formData, "pharmacyId") || null;
  const amount = Number(str(formData, "amount").replace(/\./g, "").replace(",", "."));
  const paidAt = new Date(`${str(formData, "paidAt")}T12:00:00`);

  if (description.length < 3) return { ok: false, error: "Descreva a despesa." };
  if (!CATEGORIES.includes(category)) return { ok: false, error: "Categoria inválida." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Informe um valor válido." };
  }
  if (Number.isNaN(paidAt.getTime())) return { ok: false, error: "Informe a data." };

  await prisma.expense.create({
    data: { description, category, amount, paidAt, pharmacyId },
  });
  await logAudit({
    action: "expense.create",
    entity: "Expense",
    detail: `Despesa "${description}" de R$ ${amount.toFixed(2)}`,
    pharmacyId,
  });
  revalidatePath("/admin/financeiro");
  return { ok: true };
}

export async function deleteExpense(
  expenseId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("financeiro");
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, error: "Despesa não encontrada." };

  await prisma.expense.delete({ where: { id: expenseId } });
  await logAudit({
    action: "expense.delete",
    entity: "Expense",
    entityId: expenseId,
    detail: `Despesa "${expense.description}" removida`,
    pharmacyId: expense.pharmacyId,
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
  await assertArea("financeiro");

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
          amount: t.amount,
          description: t.description,
        },
        select: { id: true },
      });
      if (dup) duplicated++;
      else fresh.push(t);
    }
  }

  if (fresh.length > 0) {
    await prisma.bankTransaction.createMany({
      data: fresh.map((t) => ({
        externalId: t.externalId,
        date: new Date(`${t.date}T12:00:00`),
        description: t.description,
        amount: t.amount,
      })),
      skipDuplicates: true,
    });
  }

  // Conciliação: créditos ainda sem pagamento × pagamentos aprovados sem extrato.
  const pending = await prisma.bankTransaction.findMany({
    where: { paymentId: null, amount: { gt: 0 } },
    select: { id: true, externalId: true, date: true, description: true, amount: true },
    orderBy: { date: "asc" },
    take: 1000,
  });
  const candidates = await prisma.payment.findMany({
    where: { status: "APPROVED", bankTx: null },
    select: { id: true, amount: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const matches = matchStatement(
    pending.map((t) => ({
      externalId: t.externalId,
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount: t.amount,
    })),
    candidates.map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.updatedAt.toISOString().slice(0, 10),
    }))
  );

  for (const [txIndex, paymentId] of matches) {
    await prisma.bankTransaction.update({
      where: { id: pending[txIndex].id },
      data: { paymentId },
    });
  }

  await logAudit({
    action: "finance.import",
    entity: "BankTransaction",
    detail: `Extrato importado: ${fresh.length} lançamentos, ${matches.size} conciliados`,
  });
  revalidatePath("/admin/financeiro");
  return { ok: true, imported: fresh.length, duplicated, matched: matches.size };
}
