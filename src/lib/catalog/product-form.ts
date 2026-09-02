import { centsToDecimal, parseMoneyInputToCents } from "@/lib/money";
import { validateProductImageUrls } from "@/lib/catalog/images";

/** Dados da oferta canônica copiados para o estoque de cada unidade. */
export type UnitOfferInput = {
  price: string;
  costPrice: string | null;
  promoPrice: string | null;
  sku: string | null;
  ean: string | null;
};

export type ProductFormState = { error?: string } | undefined;

export function parseProductForm(formData: FormData) {
  const raw = (key: string) => String(formData.get(key) ?? "").trim();
  const integer = (key: string, fallback: number) => {
    const value = raw(key);
    return value === "" ? fallback : Number(value);
  };
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    shortDescription:
      String(formData.get("shortDescription") ?? "").trim() || null,
    activeIngredient:
      String(formData.get("activeIngredient") ?? "").trim() || null,
    emoji: String(formData.get("emoji") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
    ean: String(formData.get("ean") ?? "").trim() || null,
    priceRaw: raw("price"),
    promoPriceRaw: raw("promoPrice"),
    costPriceRaw: raw("costPrice"),
    priceCents: parseMoneyInputToCents(raw("price")),
    promoPriceCents: raw("promoPrice")
      ? parseMoneyInputToCents(raw("promoPrice"))
      : null,
    costPriceCents: raw("costPrice")
      ? parseMoneyInputToCents(raw("costPrice"))
      : null,
    stock: integer("stock", 0),
    minStock: integer("minStock", 5),
    categoryId: String(formData.get("categoryId") ?? ""),
    brandId: String(formData.get("brandId") ?? "") || null,
    imageUrlsRaw: raw("imageUrls"),
    isGeneric: formData.get("isGeneric") === "on",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  };
}

export function validateProductForm(
  d: ReturnType<typeof parseProductForm>,
): { ok: true; imageUrls: string[] } | { ok: false; error: string } {
  if (!d.name || d.priceCents === null || !d.categoryId) {
    return {
      ok: false,
      error: "Nome, preço válido e categoria são obrigatórios.",
    };
  }
  if (d.priceCents <= 0)
    return { ok: false, error: "O preço deve ser maior que zero." };
  if (d.promoPriceRaw && d.promoPriceCents === null) {
    return {
      ok: false,
      error: "Preço promocional inválido (use até 2 casas).",
    };
  }
  if (d.costPriceRaw && d.costPriceCents === null) {
    return { ok: false, error: "Custo inválido (use até 2 casas)." };
  }
  if (
    d.promoPriceCents !== null &&
    (d.promoPriceCents <= 0 || d.promoPriceCents >= d.priceCents)
  ) {
    return {
      ok: false,
      error: "O preço promocional deve ser menor que o preço normal.",
    };
  }
  if (d.costPriceCents !== null && d.costPriceCents < 0) {
    return { ok: false, error: "O custo não pode ser negativo." };
  }
  if (d.ean && !/^\d{8,14}$/.test(d.ean)) {
    return { ok: false, error: "O EAN deve conter de 8 a 14 dígitos." };
  }
  if (
    !Number.isSafeInteger(d.stock) ||
    d.stock < 0 ||
    d.stock > 2_147_483_647 ||
    !Number.isSafeInteger(d.minStock) ||
    d.minStock < 0 ||
    d.minStock > 2_147_483_647
  ) {
    return {
      ok: false,
      error: "Estoque e estoque mínimo devem ser inteiros não negativos.",
    };
  }
  const images = validateProductImageUrls(d.imageUrlsRaw);
  return images.ok ? { ok: true, imageUrls: images.urls } : images;
}

export function unitOfferFromForm(
  d: ReturnType<typeof parseProductForm>,
): UnitOfferInput {
  return {
    price: centsToDecimal(d.priceCents!),
    costPrice:
      d.costPriceCents == null ? null : centsToDecimal(d.costPriceCents),
    promoPrice:
      d.promoPriceCents == null ? null : centsToDecimal(d.promoPriceCents),
    sku: d.sku,
    ean: d.ean,
  };
}
