/**
 * Lógica pura dos relatórios gerenciais (curva ABC, sugestão de compra, DRE).
 * Sem Prisma/IO — tudo testável em unit test. Os loaders que alimentam estas
 * funções ficam em `src/lib/admin-reports.ts`.
 */

import type { ExpenseCategory } from "@prisma/client";

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  RENT: "Aluguel",
  PAYROLL: "Folha de pagamento",
  SUPPLIER: "Fornecedores",
  MARKETING: "Marketing",
  TAX: "Impostos",
  UTILITIES: "Água / luz / internet",
  OTHER: "Outros",
};

export type AbcClass = "A" | "B" | "C";

export type AbcRow<T> = T & {
  /** Fatia deste item na receita total (0–1). */
  share: number;
  /** Fatia acumulada até este item, inclusive (0–1). */
  cumulative: number;
  abcClass: AbcClass;
};

/**
 * Curva ABC por receita: ordena do maior para o menor e classifica pela fatia
 * acumulada em que o item COMEÇA — assim o primeiro item é sempre A, mesmo
 * quando concentra sozinho mais de 80% da receita.
 *  - A: começa antes de 80% do acumulado (itens que sustentam o faturamento)
 *  - B: começa entre 80% e 95%
 *  - C: cauda final (últimos 5%)
 * Receita total zerada → tudo C (não há venda para ranquear).
 */
export function classifyAbc<T extends { revenue: number }>(
  items: T[]
): AbcRow<T>[] {
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((sum, item) => sum + item.revenue, 0);
  if (total <= 0) {
    return sorted.map((item) => ({
      ...item,
      share: 0,
      cumulative: 0,
      abcClass: "C" as const,
    }));
  }
  let acc = 0;
  return sorted.map((item) => {
    const startsAt = acc / total;
    acc += item.revenue;
    const abcClass: AbcClass =
      startsAt < 0.8 ? "A" : startsAt < 0.95 ? "B" : "C";
    return {
      ...item,
      share: item.revenue / total,
      cumulative: acc / total,
      abcClass,
    };
  });
}

export type StockLevels = {
  stock: number;
  minStock: number;
  maxStock: number | null;
};

/**
 * Sugestão de compra: só repõe quando o estoque atingiu o mínimo, e a compra
 * leva o estoque de volta ao máximo. Sem máximo definido, o alvo é 2× o mínimo
 * (colchão razoável até o dono calibrar os níveis).
 */
export function suggestPurchase(levels: StockLevels): number {
  if (levels.stock > levels.minStock) return 0;
  const target = levels.maxStock ?? levels.minStock * 2;
  return Math.max(0, target - levels.stock);
}

export type DreInput = {
  /** Receita bruta dos pedidos pagos (produtos + frete). */
  grossRevenue: number;
  /** Descontos concedidos (cupons). */
  discounts: number;
  /** CMV — custo das mercadorias vendidas (qty × custo de aquisição). */
  cogs: number;
  /** Despesas operacionais do período (aluguel, folha, etc.). */
  expenses: number;
};

export type DreSummary = DreInput & {
  netRevenue: number;
  grossProfit: number;
  result: number;
  /** Margem líquida sobre a receita líquida (0–1); null sem receita. */
  margin: number | null;
};

/** DRE gerencial simplificada: receita → deduções → CMV → despesas → resultado. */
export function buildDre(input: DreInput): DreSummary {
  const netRevenue = input.grossRevenue - input.discounts;
  const grossProfit = netRevenue - input.cogs;
  const result = grossProfit - input.expenses;
  return {
    ...input,
    netRevenue,
    grossProfit,
    result,
    margin: netRevenue > 0 ? result / netRevenue : null,
  };
}

export type CashFlowEntry = {
  /** Dia no formato yyyy-mm-dd. */
  date: string;
  inflow: number;
  outflow: number;
};

export type CashFlowRow = CashFlowEntry & {
  net: number;
  /** Saldo acumulado desde o início do período. */
  balance: number;
};

/**
 * DFC (fluxo de caixa) diário: consolida entradas e saídas por dia e acumula o
 * saldo. Dias sem movimento não aparecem (a tabela mostra só o que aconteceu).
 */
export function buildCashFlow(entries: CashFlowEntry[]): CashFlowRow[] {
  const byDay = new Map<string, { inflow: number; outflow: number }>();
  for (const e of entries) {
    const cur = byDay.get(e.date) ?? { inflow: 0, outflow: 0 };
    cur.inflow += e.inflow;
    cur.outflow += e.outflow;
    byDay.set(e.date, cur);
  }
  let balance = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, { inflow, outflow }]) => {
      const net = inflow - outflow;
      balance += net;
      return { date, inflow, outflow, net, balance };
    });
}
