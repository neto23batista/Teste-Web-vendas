import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pharmacy: { findMany: (...a: unknown[]) => findMany(...a) },
    pharmacyCepRange: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));

// unstable_cache apenas executa a função (sem cache) nos testes.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

// next/headers não é usado por estas funções, mas o módulo o importa.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { resolvePharmacyByCep, cepToInt } from "@/lib/pharmacy";

const MATRIZ = { id: "m", name: "Matriz", slug: "matriz", type: "MATRIZ" };
const FILIAL = { id: "f", name: "Filial", slug: "filial", type: "FILIAL" };

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
  findMany.mockResolvedValue([MATRIZ, FILIAL]);
  findFirst.mockResolvedValue(null);
});

describe("cepToInt", () => {
  it("converte CEP de 8 dígitos (com ou sem máscara)", () => {
    expect(cepToInt("09010-000")).toBe(9010000);
    expect(cepToInt("01310100")).toBe(1310100);
  });
  it("retorna null para CEP inválido", () => {
    expect(cepToInt("123")).toBeNull();
    expect(cepToInt("")).toBeNull();
    expect(cepToInt(null)).toBeNull();
    expect(cepToInt("0901000000")).toBeNull();
  });
});

describe("resolvePharmacyByCep", () => {
  it("cai na matriz quando o CEP é inválido/ausente", async () => {
    const r = await resolvePharmacyByCep(null);
    expect(r?.id).toBe("m");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("roteia para a unidade cuja faixa contém o CEP", async () => {
    findFirst.mockResolvedValue({ pharmacy: FILIAL });
    const r = await resolvePharmacyByCep("09010-000");
    expect(r?.id).toBe("f");
  });

  it("cai na matriz quando nenhuma faixa cobre o CEP", async () => {
    findFirst.mockResolvedValue(null);
    const r = await resolvePharmacyByCep("70000-000");
    expect(r?.id).toBe("m");
  });
});
