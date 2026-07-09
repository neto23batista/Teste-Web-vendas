import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

/**
 * Upsert do catálogo vindo da InovaFarma (via conector) para UMA unidade.
 *
 * Regras:
 * - Match por SKU (código InovaFarma, único) e, na falta, por EAN.
 * - Produto existente: atualiza preço/promoção (e tarja, se informada) e o
 *   estoque da unidade. Nome/descrição/foto NÃO são sobrescritos — curadoria
 *   feita no admin prevalece.
 * - Produto novo: criado INATIVO (active=false) para o admin revisar
 *   (emoji/foto/categoria) antes de aparecer na loja.
 */

export type CatalogItem = {
  sku: string;
  ean?: string | null;
  nome: string;
  preco: number;
  promo?: number | null;
  estoque: number;
  /** true = exige receita (tarja). Só é aplicada quando informada. */
  tarja?: boolean | null;
  categoria?: string | null;
};

export type CatalogResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "produto";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Categoria fallback para produtos criados pela integração. */
async function fallbackCategoryId(name?: string | null): Promise<string> {
  const catName = name?.trim() || "Outros";
  const slug = slugify(catName) || "outros";
  const cat = await prisma.category.upsert({
    where: { slug },
    update: {},
    create: { name: catName, slug, sort: 999 },
  });
  return cat.id;
}

function validItem(raw: unknown): CatalogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sku = typeof r.sku === "string" ? r.sku.trim() : "";
  const nome = typeof r.nome === "string" ? r.nome.trim() : "";
  const preco = Number(r.preco);
  const estoque = Math.trunc(Number(r.estoque));
  if (!sku || !nome || !Number.isFinite(preco) || preco < 0) return null;
  const promo = r.promo == null ? null : Number(r.promo);
  return {
    sku,
    nome: nome.slice(0, 200),
    ean: typeof r.ean === "string" && r.ean.trim() ? r.ean.trim() : null,
    preco,
    promo: Number.isFinite(promo as number) && (promo as number) > 0 ? promo : null,
    estoque: Number.isFinite(estoque) && estoque >= 0 ? estoque : 0,
    tarja: typeof r.tarja === "boolean" ? r.tarja : null,
    categoria:
      typeof r.categoria === "string" && r.categoria.trim() ? r.categoria.trim() : null,
  };
}

export async function upsertCatalog(
  pharmacyId: string,
  rawItems: unknown[]
): Promise<CatalogResult> {
  const result: CatalogResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const raw of rawItems) {
    const item = validItem(raw);
    if (!item) {
      result.skipped++;
      continue;
    }
    try {
      let product = await prisma.product.findUnique({ where: { sku: item.sku } });
      if (!product && item.ean) {
        product = await prisma.product.findFirst({ where: { ean: item.ean } });
      }

      if (product) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            price: item.preco,
            promoPrice: item.promo,
            ean: item.ean ?? product.ean,
            // Garante o vínculo por SKU nos matches que vieram por EAN.
            sku: product.sku ?? item.sku,
            ...(item.tarja != null ? { requiresPrescription: item.tarja } : {}),
          },
        });
        result.updated++;
      } else {
        product = await prisma.product.create({
          data: {
            name: item.nome,
            slug: await uniqueSlug(item.nome),
            description: item.nome,
            sku: item.sku,
            ean: item.ean,
            price: item.preco,
            promoPrice: item.promo,
            requiresPrescription: item.tarja ?? false,
            active: false, // curadoria no admin antes de ir à loja
            categoryId: await fallbackCategoryId(item.categoria),
          },
        });
        result.created++;
      }

      await prisma.inventory.upsert({
        where: { productId_pharmacyId: { productId: product.id, pharmacyId } },
        update: { stock: item.estoque },
        create: { productId: product.id, pharmacyId, stock: item.estoque },
      });
    } catch (err) {
      result.errors.push(
        `${item.sku}: ${err instanceof Error ? err.message : "erro"}`
      );
    }
  }

  // Preço/estoque mudaram — invalida as listas cacheadas da loja.
  // ("max" = revalida já; mesmo padrão de revalidateProductsSafe em orders.ts)
  try {
    revalidateTag("products", "max");
  } catch {
    // fora de contexto de request (testes) não há cache a invalidar
  }
  return result;
}
