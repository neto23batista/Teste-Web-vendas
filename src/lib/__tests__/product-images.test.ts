import { describe, expect, it } from "vitest";
import { validateProductImageUrls } from "@/lib/product-images";

describe("validateProductImageUrls", () => {
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
