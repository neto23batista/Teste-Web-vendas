import "server-only";

import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/auth/session";
import { getFinanceReport } from "@/lib/admin/reports";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { moneyToNumber } from "@/lib/money";

/** Consolida o painel financeiro sem expor payloads/erros internos de pagamento. */
export async function getAdminFinanceView(month?: string, selectedUnitId?: string) {
  await requireArea("financeiro");
  const today = new Date();
  const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "") ? month! : fallback;
  // A quarentena NÃO é filtrada por mês nem por unidade: enquanto houver
  // dinheiro possivelmente retido no provedor, o caso precisa aparecer em
  // qualquer recorte que o financeiro estiver olhando.
  const quarantined = (
    await prisma.payment.findMany({
      where: { status: "QUARANTINED" },
      orderBy: { updatedAt: "asc" },
      take: 50,
      select: {
        externalId: true,
        reconciliationError: true,
        updatedAt: true,
        order: {
          select: { id: true, number: true, total: true, customerName: true },
        },
      },
    })
  ).map((payment) => ({
    orderId: payment.order.id,
    number: payment.order.number,
    total: moneyToNumber(payment.order.total),
    customerName: payment.order.customerName,
    externalId: payment.externalId,
    detail: payment.reconciliationError ? `Divergência no pagamento. Referência: pedido ${payment.order.number}.` : null,
    since: payment.updatedAt.toLocaleDateString("pt-BR"),
  }));

  const report = await getFinanceReport(mes, selectedUnitId);
  const { dre, cashFlow, expensesByCategory, itemsWithoutCost, from, to } = report;

  const [expenses, bankTx, unmatchedTotal, pharmacies] = await Promise.all([
    prisma.expense.findMany({
      where: { paidAt: { gte: from, lt: to } },
      orderBy: { paidAt: "desc" },
      include: { pharmacy: { select: { name: true } } },
    }),
    prisma.bankTransaction.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: "desc" },
      take: 100,
      include: { payment: { select: { order: { select: { number: true } } } } },
    }),
    prisma.bankTransaction.count({ where: { paymentId: null, amount: { gt: 0 } } }),
    listPharmaciesSafe(),
  ]);

  const expenseRows = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    category: e.category,
    amount: moneyToNumber(e.amount),
    paidAt: e.paidAt.toLocaleDateString("pt-BR"),
    pharmacyName: e.pharmacy?.name ?? null,
  }));


  return {
    mes, dre, cashFlow, expensesByCategory, itemsWithoutCost, from,
    quarantined, expenseRows, unmatchedTotal,
    pharmacies: pharmacies.map(({ id, name }) => ({ id, name })),
    bankTx: bankTx.map((transaction) => ({
      id: transaction.id, date: transaction.date, description: transaction.description,
      amount: moneyToNumber(transaction.amount, true), paymentId: transaction.paymentId,
      payment: transaction.payment,
    })),
  };
}
