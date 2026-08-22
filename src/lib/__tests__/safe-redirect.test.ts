import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "@/lib/safe-redirect";

describe("safeInternalRedirect", () => {
  it("aceita caminho interno com query e fragmento", () => {
    expect(safeInternalRedirect(" /checkout?cupom=BEMVINDO#pagamento ")).toBe(
      "/checkout?cupom=BEMVINDO#pagamento"
    );
  });

  it.each([
    "https://evil.example/roubar",
    "//evil.example/roubar",
    "/\\evil.example/roubar",
    "/%2f%2fevil.example/roubar",
    "/%255cevil.example/roubar",
    "\\\\evil.example\\roubar",
    "javascript:alert(1)",
    "checkout",
    "/checkout\nSet-Cookie: session=roubada",
  ])("rejeita destino externo ou ambíguo: %s", (value) => {
    expect(safeInternalRedirect(value)).toBeNull();
  });

  it("rejeita valores que não são strings", () => {
    expect(safeInternalRedirect(null)).toBeNull();
    expect(safeInternalRedirect(undefined)).toBeNull();
    expect(safeInternalRedirect(123)).toBeNull();
  });
});
