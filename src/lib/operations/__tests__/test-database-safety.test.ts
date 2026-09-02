import { describe, expect, it } from "vitest";
import {
  assertDisposableTestDatabase,
  assertLocalTestServer,
  DISPOSABLE_DATABASE_CONFIRMATION,
} from "../test-database-safety";

const input = {
  url: "postgresql://tester:password@127.0.0.1:55432/farmavida_test",
  confirmation: DISPOSABLE_DATABASE_CONFIRMATION,
};

describe("isolamento dos testes com escrita", () => {
  it("aceita somente o banco local explicitamente confirmado", () => {
    expect(assertDisposableTestDatabase(input)).toBe(input.url);
  });
  it.each([undefined, "1", "true"])(
    "recusa confirmação incompleta: %s",
    (confirmation) => {
      expect(() =>
        assertDisposableTestDatabase({ ...input, confirmation }),
      ).toThrow(/Confirme/);
    },
  );
  it.each([
    "postgresql://user:secret@production.example.com/farmavida_test",
    "postgresql://user:secret@localhost/farmavida",
    "postgresql://user:secret@localhost/farmavida_test?host=production.example.com",
    "postgresql://user:secret@localhost/farmavida_test?dbname=production",
    "https://user:secret@localhost/farmavida_test",
    "not-a-url-containing-secret",
  ])("recusa destino inseguro sem revelar suas credenciais", (url) => {
    try {
      assertDisposableTestDatabase({ ...input, url });
      throw new Error("accepted");
    } catch (error) {
      expect((error as Error).message).not.toBe("accepted");
      expect((error as Error).message).not.toContain("secret");
    }
  });
  it("recusa execução marcada como produção mesmo em loopback", () => {
    expect(() =>
      assertDisposableTestDatabase({ ...input, appEnv: "production" }),
    ).toThrow(/produção/);
  });
  it("aceita uma origem HTTP local para E2E", () => {
    expect(() => assertLocalTestServer("http://localhost:3210")).not.toThrow();
  });
  it.each([
    "https://example.com",
    "http://user:pass@localhost:3210",
    "http://localhost:3210/admin",
  ])("recusa origem E2E de escrita ambígua: %s", (url) => {
    expect(() => assertLocalTestServer(url)).toThrow(/local/);
  });
});
