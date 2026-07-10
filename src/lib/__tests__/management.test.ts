import { describe, it, expect } from "vitest";
import {
  classifyAbc,
  suggestPurchase,
  buildDre,
  buildCashFlow,
} from "@/lib/management";

describe("classifyAbc", () => {
  it("classifica pela fatia acumulada em que o item começa (A ≤80%, B ≤95%, C resto)", () => {
    const rows = classifyAbc([
      { name: "cauda-1", revenue: 30 },
      { name: "campeão", revenue: 800 },
      { name: "meio", revenue: 150 },
      { name: "cauda-2", revenue: 20 },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["campeão", "meio", "cauda-1", "cauda-2"]);
    expect(rows.map((r) => r.abcClass)).toEqual(["A", "B", "C", "C"]);
  });

  it("um único produto com toda a receita é classe A (não C)", () => {
    const [row] = classifyAbc([{ name: "único", revenue: 500 }]);
    expect(row.abcClass).toBe("A");
    expect(row.share).toBe(1);
    expect(row.cumulative).toBe(1);
  });

  it("receita zerada → tudo C, sem divisão por zero", () => {
    const rows = classifyAbc([
      { name: "a", revenue: 0 },
      { name: "b", revenue: 0 },
    ]);
    expect(rows.every((r) => r.abcClass === "C")).toBe(true);
    expect(rows.every((r) => r.share === 0)).toBe(true);
  });

  it("lista vazia → lista vazia", () => {
    expect(classifyAbc([])).toEqual([]);
  });

  it("acumulado do último item fecha em 100%", () => {
    const rows = classifyAbc([
      { name: "a", revenue: 10 },
      { name: "b", revenue: 20 },
      { name: "c", revenue: 70 },
    ]);
    expect(rows[rows.length - 1].cumulative).toBeCloseTo(1);
  });
});

describe("suggestPurchase", () => {
  it("estoque acima do mínimo → não sugere compra", () => {
    expect(suggestPurchase({ stock: 10, minStock: 5, maxStock: 30 })).toBe(0);
  });

  it("estoque no mínimo → repõe até o máximo", () => {
    expect(suggestPurchase({ stock: 5, minStock: 5, maxStock: 30 })).toBe(25);
  });

  it("estoque zerado sem máximo definido → alvo é 2× o mínimo", () => {
    expect(suggestPurchase({ stock: 0, minStock: 5, maxStock: null })).toBe(10);
  });

  it("máximo menor que o estoque atual não vira sugestão negativa", () => {
    expect(suggestPurchase({ stock: 4, minStock: 5, maxStock: 3 })).toBe(0);
  });
});

describe("buildDre", () => {
  it("encadeia receita → deduções → CMV → despesas → resultado", () => {
    const dre = buildDre({
      grossRevenue: 10_000,
      discounts: 500,
      cogs: 4_000,
      expenses: 3_000,
    });
    expect(dre.netRevenue).toBe(9_500);
    expect(dre.grossProfit).toBe(5_500);
    expect(dre.result).toBe(2_500);
    expect(dre.margin).toBeCloseTo(2_500 / 9_500);
  });

  it("sem receita → margem null (não NaN/Infinity)", () => {
    const dre = buildDre({ grossRevenue: 0, discounts: 0, cogs: 0, expenses: 100 });
    expect(dre.result).toBe(-100);
    expect(dre.margin).toBeNull();
  });
});

describe("buildCashFlow", () => {
  it("consolida por dia, ordena e acumula o saldo", () => {
    const rows = buildCashFlow([
      { date: "2026-07-02", inflow: 0, outflow: 300 },
      { date: "2026-07-01", inflow: 100, outflow: 0 },
      { date: "2026-07-01", inflow: 50, outflow: 0 },
    ]);
    expect(rows).toEqual([
      { date: "2026-07-01", inflow: 150, outflow: 0, net: 150, balance: 150 },
      { date: "2026-07-02", inflow: 0, outflow: 300, net: -300, balance: -150 },
    ]);
  });

  it("sem movimentação → vazio", () => {
    expect(buildCashFlow([])).toEqual([]);
  });
});
