import { describe, expect, it } from "vitest";
import {
  assertDestructiveSeedAllowed,
  DESTRUCTIVE_SEED_CONFIRMATION,
} from "@/lib/operations/seed-safety";

const local = {
  ALLOW_DESTRUCTIVE_SEED: DESTRUCTIVE_SEED_CONFIRMATION,
  DATABASE_URL: "postgresql://user:pass@localhost:5432/farmavida_dev",
};

describe("proteção do seed destrutivo", () => {
  it("permite somente confirmação explícita em banco local", () => {
    expect(() => assertDestructiveSeedAllowed(local)).not.toThrow();
  });

  it("bloqueia sem confirmação", () => {
    expect(() =>
      assertDestructiveSeedAllowed({ DATABASE_URL: local.DATABASE_URL })
    ).toThrow(/ALLOW_DESTRUCTIVE_SEED/);
  });

  it("bloqueia produção mesmo com confirmação", () => {
    expect(() =>
      assertDestructiveSeedAllowed({ ...local, NODE_ENV: "production" })
    ).toThrow(/produção/);
    expect(() =>
      assertDestructiveSeedAllowed({ ...local, VERCEL_ENV: "production" })
    ).toThrow(/produção/);
  });

  it("bloqueia qualquer host remoto", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        ...local,
        DATABASE_URL: "postgresql://user:pass@ep-production.neon.tech/farmavida",
      })
    ).toThrow(/host não local/);
  });

  it("aceita endereços de loopback IPv4 e IPv6", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        ...local,
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/test",
      })
    ).not.toThrow();
    expect(() =>
      assertDestructiveSeedAllowed({
        ...local,
        DATABASE_URL: "postgresql://user:pass@[::1]:5432/test",
      })
    ).not.toThrow();
  });
});
