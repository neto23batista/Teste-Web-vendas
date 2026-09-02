import { prisma } from "@/lib/prisma";
import { resolveUnitFilter } from "@/lib/admin";
import {
  classifyAbc,
  suggestPurchase,
  buildDre,
  buildCashFlow,
  type AbcRow,
} from "@/lib/management";
import type { OrderStatus, ExpenseCategory } from "@prisma/client";
import { centsToNumber, moneyToCents, moneyToNumber } from "@/lib/money";

const PAID_STATUSES: OrderStatus[] = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

// ─────────────────────────── Curva ABC ───────────────────────────

export type AbcProduct = {
  key: string;
  name: string;
  qty: number;
  revenue: number;
};

/** Curva ABC de vendas do período. Agrega por produto (itens de produto
 *  excluído contam pelo nome congelado no pedido). */
export async function getAbcReport(days = 30, selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: PAID_STATUSES },
        createdAt: { gte: since },
        ...(unit ? { pharmacyId: unit } : {}),
      },
    },
    select: { productId: true, name: true, qty: true, price: true },
  });

  const byProduct = new Map<
    string,
    Omit<AbcProduct, "revenue"> & { revenueCents: number }
  >();
  for (const it of items) {
    const key = it.productId ?? `nome:${it.name}`;
    const cur = byProduct.get(key) ?? {
      key,
      name: it.name,
      qty: 0,
      revenueCents: 0,
    };
    cur.qty += it.qty;
    cur.revenueCents += (moneyToCents(it.price) ?? 0) * it.qty;
    byProduct.set(key, cur);
  }

  const rows: AbcRow<AbcProduct>[] = classifyAbc(
    [...byProduct.values()].map(({ revenueCents, ...row }) => ({
      ...row,
      revenue: centsToNumber(revenueCents),
    }))
  );
  return {
    since,
    rows,
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
  };
}

// ─────────────────────── Sugestão de compra ───────────────────────

export type PurchaseRow = {
  inventoryId: string;
  productId: string;
  name: string;
  emoji: string | null;
  sku: string | null;
  ean: string | null;
  category: string;
  costPrice: number | null;
  stock: number;
  minStock: number;
  maxStock: number | null;
  /** Quantidade sugerida para o pedido de compra (0 = não precisa repor). */
  suggested: number;
};

/**
 * Níveis de estoque + sugestão de compra da unidade. Igual ao Controle de
 * estoque, a sugestão age sobre UMA unidade concreta (matriz como referência
 * quando "todas" está selecionado).
 */
export async function getPurchaseSuggestions(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const targetUnit =
    unit ??
    (
      await prisma.pharmacy.findFirst({
        where: { type: "MATRIZ", archivedAt: null },
        select: { id: true },
      })
    )?.id ??
    null;
  if (!targetUnit) return { unitId: null, rows: [] as PurchaseRow[] };

  const invs = await prisma.inventory.findMany({
    where: { pharmacyId: targetUnit, product: { active: true } },
    select: {
      id: true,
      stock: true,
      minStock: true,
      maxStock: true,
      costPrice: true,
      sku: true,
      ean: true,
      product: {
        select: {
          id: true,
          name: true,
          emoji: true,
          sku: true,
          ean: true,
          costPrice: true,
          category: { select: { name: true } },
        },
      },
    },
    take: 500,
  });

  const rows: PurchaseRow[] = invs
    .map((iv) => ({
      inventoryId: iv.id,
      productId: iv.product.id,
      name: iv.product.name,
      emoji: iv.product.emoji,
      sku: iv.sku ?? iv.product.sku,
      ean: iv.ean ?? iv.product.ean,
      category: iv.product.category.name,
      costPrice:
        (iv.costPrice ?? iv.product.costPrice) == null
          ? null
          : moneyToNumber(iv.costPrice ?? iv.product.costPrice!),
      stock: iv.stock,
      minStock: iv.minStock,
      maxStock: iv.maxStock,
      suggested: suggestPurchase(iv),
    }))
    // Quem precisa repor primeiro; depois os demais por estoque crescente.
    .sort((a, b) => b.suggested - a.suggested || a.stock - b.stock);

  return { unitId: targetUnit, rows };
}

// ─────────────────────────── DRE + DFC ───────────────────────────

export type FinanceReport = {
  from: Date;
  to: Date;
  dre: ReturnType<typeof buildDre>;
  /** Itens vendidos sem custo cadastrado — o CMV está subestimado. */
  itemsWithoutCost: number;
  expensesByCategory: { category: ExpenseCategory; total: number }[];
  cashFlow: ReturnType<typeof buildCashFlow>;
};

/** DRE e fluxo de caixa do mês (yyyy-mm), no escopo da unidade selecionada.
 *  Despesas sem unidade (gerais) entram em qualquer escopo. */
export async function getFinanceReport(
  month: string,
  selectedUnitId?: string | null
): Promise<FinanceReport> {
  const unit = await resolveUnitFilter(selectedUnitId);
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, (m || 1) - 1, 1);
  const to = new Date(y, m || 1, 1);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: PAID_STATUSES },
        createdAt: { gte: from, lt: to },
        ...(unit ? { pharmacyId: unit } : {}),
      },
      select: {
        total: true,
        discount: true,
        createdAt: true,
        items: {
          select: { qty: true, product: { select: { costPrice: true } } },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        ...(unit ? { OR: [{ pharmacyId: unit }, { pharmacyId: null }] } : {}),
      },
      select: { category: true, amount: true, paidAt: true },
    }),
  ]);

  let grossRevenueCents = 0;
  let discountsCents = 0;
  let cogsCents = 0;
  let itemsWithoutCost = 0;
  const flowCents: { date: string; inflow: number; outflow: number }[] = [];

  for (const o of orders) {
    const totalCents = moneyToCents(o.total) ?? 0;
    const discountCents = moneyToCents(o.discount) ?? 0;
    grossRevenueCents += totalCents + discountCents;
    discountsCents += discountCents;
    for (const it of o.items) {
      const cost = it.product?.costPrice;
      if (cost == null) itemsWithoutCost += it.qty;
      else cogsCents += (moneyToCents(cost) ?? 0) * it.qty;
    }
    flowCents.push({
      date: o.createdAt.toISOString().slice(0, 10),
      inflow: totalCents,
      outflow: 0,
    });
  }

  const byCategoryCents = new Map<ExpenseCategory, number>();
  let totalExpensesCents = 0;
  for (const e of expenses) {
    const amountCents = moneyToCents(e.amount) ?? 0;
    byCategoryCents.set(
      e.category,
      (byCategoryCents.get(e.category) ?? 0) + amountCents
    );
    totalExpensesCents += amountCents;
    flowCents.push({
      date: e.paidAt.toISOString().slice(0, 10),
      inflow: 0,
      outflow: amountCents,
    });
  }
  const flow = flowCents.map((entry) => ({
    ...entry,
    inflow: centsToNumber(entry.inflow),
    outflow: centsToNumber(entry.outflow),
  }));

  return {
    from,
    to,
    dre: buildDre({
      grossRevenue: centsToNumber(grossRevenueCents),
      discounts: centsToNumber(discountsCents),
      cogs: centsToNumber(cogsCents),
      expenses: centsToNumber(totalExpensesCents),
    }),
    itemsWithoutCost,
    expensesByCategory: [...byCategoryCents.entries()]
      .map(([category, total]) => ({ category, total: centsToNumber(total) }))
      .sort((a, b) => b.total - a.total),
    cashFlow: buildCashFlow(flow),
  };
}
