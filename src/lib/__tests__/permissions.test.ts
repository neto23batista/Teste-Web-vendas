import { describe, it, expect } from "vitest";
import { canAccess, effectiveProfile } from "@/lib/permissions";

describe("permissions", () => {
  it("conta antiga (staffProfile null) é tratada como OWNER e mantém acesso total", () => {
    expect(effectiveProfile(null)).toBe("OWNER");
    for (const area of ["financeiro", "equipe", "auditoria", "configuracoes"] as const) {
      expect(canAccess(null, area), area).toBe(true);
    }
  });

  it("OWNER acessa tudo", () => {
    expect(canAccess("OWNER", "financeiro")).toBe(true);
    expect(canAccess("OWNER", "compras")).toBe(true);
    expect(canAccess("OWNER", "equipe")).toBe(true);
  });

  it("farmacêutico: pedidos/clientes sim; estoque, financeiro e equipe não", () => {
    expect(canAccess("PHARMACIST", "pedidos")).toBe(true);
    expect(canAccess("PHARMACIST", "clientes")).toBe(true);
    expect(canAccess("PHARMACIST", "estoque")).toBe(false);
    expect(canAccess("PHARMACIST", "financeiro")).toBe(false);
    expect(canAccess("PHARMACIST", "equipe")).toBe(false);
  });

  it("estoquista: produtos/estoque/compras/integração sim; pedidos não", () => {
    expect(canAccess("STOCKIST", "estoque")).toBe(true);
    expect(canAccess("STOCKIST", "compras")).toBe(true);
    expect(canAccess("STOCKIST", "integracao")).toBe(true);
    expect(canAccess("STOCKIST", "pedidos")).toBe(false);
  });

  it("atendente: pedidos/entregas/clientes sim; produtos e financeiro não", () => {
    expect(canAccess("ATTENDANT", "entregas")).toBe(true);
    expect(canAccess("ATTENDANT", "pedidos")).toBe(true);
    expect(canAccess("ATTENDANT", "produtos")).toBe(false);
    expect(canAccess("ATTENDANT", "financeiro")).toBe(false);
  });

  it("nenhum perfil não-OWNER acessa dinheiro, equipe ou auditoria", () => {
    for (const p of ["PHARMACIST", "STOCKIST", "ATTENDANT"] as const) {
      expect(canAccess(p, "financeiro"), p).toBe(false);
      expect(canAccess(p, "relatorios"), p).toBe(false);
      expect(canAccess(p, "equipe"), p).toBe(false);
      expect(canAccess(p, "auditoria"), p).toBe(false);
      expect(canAccess(p, "configuracoes"), p).toBe(false);
    }
  });
});
