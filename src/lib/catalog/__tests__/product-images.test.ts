import { describe, expect, it } from "vitest";
import { validateProductImageUrls } from "@/lib/catalog/images";

describe("validateProductImageUrls", () => {
  it("aceita fotos locais revisadas e remove duplicatas", () => {
    expect(validateProductImageUrls("/products/sku-123.webp\n/products/sku-123.webp")).toEqual({ ok: true, urls: ["/products/sku-123.webp"] });
  });
  it.each(["/products/../secret.png", "/products/%2e%2e%2fsecret.png", "//evil.test/a.png", "/products/a.svg", "/products/a.webp?x=1", "/other/a.png"])("rejeita caminho local inseguro: %s", (path) => {
    expect(validateProductImageUrls(path).ok).toBe(false);
  });
  it("aceita apenas os hosts HTTPS configurados no Next Image", () => {
    expect(
      validateProductImageUrls("https://images.unsplash.com/photo-1\nhttps://images.pexels.com/photos/2")
    ).toMatchObject({ ok: true });
    expect(validateProductImageUrls("http://images.unsplash.com/photo-1")).toMatchObject({
      ok: false,
    });
    expect(validateProductImageUrls("https://cdn.example.com/photo.jpg")).toMatchObject({
      ok: false,
    });
  });

  it("não descarta URL inválida silenciosamente", () => {
    const result = validateProductImageUrls("não é url");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/inválida/i);
  });
});
