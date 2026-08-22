import { describe, expect, it } from "vitest";
import {
  assertHandoverCleanupAllowed,
  handoverPasswordMode,
  HANDOVER_SAFETY_CONFIRMATIONS,
} from "@/lib/handover-safety";

const local = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/farmavida_handover",
  ALLOW_DESTRUCTIVE_HANDOVER: HANDOVER_SAFETY_CONFIRMATIONS.destructive,
};

describe("segurança da limpeza de handover", () => {
  it("nega sem a confirmação destrutiva", () => {
    expect(() =>
      assertHandoverCleanupAllowed({ DATABASE_URL: local.DATABASE_URL })
    ).toThrow(/bloqueado/i);
  });

  it.each([
    { NODE_ENV: "production" },
    { VERCEL_ENV: "production" },
    { APP_ENV: "production" },
    { VERCEL: "1" },
  ])("nega qualquer ambiente live/Vercel: %o", (signal) => {
    expect(() => assertHandoverCleanupAllowed({ ...local, ...signal })).toThrow(
      /live\/Vercel/i
    );
  });

  it("exige uma segunda confirmação para banco remoto", () => {
    const remote = {
      ...local,
      DATABASE_URL: "postgresql://user:pass@db.staging.internal:5432/farmavida",
    };
    expect(() => assertHandoverCleanupAllowed(remote)).toThrow(/confirmação remota/i);
    expect(() =>
      assertHandoverCleanupAllowed({
        ...remote,
        ALLOW_REMOTE_DESTRUCTIVE_HANDOVER: HANDOVER_SAFETY_CONFIRMATIONS.remote,
      })
    ).not.toThrow();
  });

  it("aceita PostgreSQL local após confirmação explícita", () => {
    expect(() => assertHandoverCleanupAllowed(local)).not.toThrow();
  });

  it("não expõe senha por padrão e rejeita senha fraca", () => {
    expect(() => handoverPasswordMode(local)).toThrow(/canal secreto/i);
    for (const password of [
      "Senha123456",
      "abcdefghijklmnopqrstuvwx",
      "Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!",
      "00000000000000000000000000000000",
      "vN7!pK2@qR9#xT4$zW8&cM6ç",
    ]) {
      expect(() =>
        handoverPasswordMode({
          ...local,
          HANDOVER_OWNER_PASSWORD: password,
        })
      ).toThrow(/fraca/i);
    }
  });

  it("aceita segredos fornecidos com espaço de busca nominal >= 128 bits", () => {
    expect(
      handoverPasswordMode({
        ...local,
        HANDOVER_OWNER_PASSWORD: "vN7!pK2@qR9#xT4$zW8&cM6*",
      })
    ).toBe("provided");
    expect(
      handoverPasswordMode({
        ...local,
        HANDOVER_OWNER_PASSWORD: "9f1c7e2a6b4d8f035ace719b2d64e8f0",
      })
    ).toBe("provided");
  });

  it("mantém a geração de 192 bits atrás do opt-in separado", () => {
    expect(
      handoverPasswordMode({
        ...local,
        HANDOVER_PRINT_INITIAL_PASSWORD:
          HANDOVER_SAFETY_CONFIRMATIONS.printPassword,
      })
    ).toBe("generate-and-print");
  });
});
