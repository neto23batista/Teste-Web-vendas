import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";
import {
  centsToDecimal,
  centsToNumber,
  moneyToCents,
  parseMoneyInputToCents,
} from "@/lib/money";

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
  /**
   * true = item de tarja (exige receita) segundo o PDV. A loja NÃO vende produto
   * sob prescrição nem recebe receita. A classificação desativa o item e não
   * pode ser revertida automaticamente por uma sincronização posterior.
   */
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

const EXISTING_WRITE_CONCURRENCY = 20;
const CREATE_BATCH_SIZE = 100;

function importedSlug(name: string, sku: string): string {
  const base = (slugify(name) || "produto").slice(0, 65);
  // O SKU é único. O sufixo determinístico evita uma consulta de colisão por
  // produto e ainda mantém a parte legível do slug para a curadoria posterior.
  const suffix = createHash("sha256").update(sku).digest("hex").slice(0, 12);
  return `${base}-${suffix}`;
}

function chunksOf<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

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
  const precoCents = parseMoneyInputToCents(
    typeof r.preco === "string" || typeof r.preco === "number" ? r.preco : ""
  );
  const estoque = Math.trunc(Number(r.estoque));
  if (!sku || !nome || precoCents === null || precoCents < 0) return null;
  const promoCents =
    r.promo == null
      ? null
      : parseMoneyInputToCents(
          typeof r.promo === "string" || typeof r.promo === "number" ? r.promo : ""
        );
  if (r.promo != null && promoCents === null) return null;
  return {
    sku,
    nome: nome.slice(0, 200),
    ean: typeof r.ean === "string" && r.ean.trim() ? r.ean.trim() : null,
    preco: centsToNumber(precoCents),
    promo:
      promoCents !== null && promoCents > 0 && promoCents < precoCents
        ? centsToNumber(promoCents)
        : null,
    estoque: Number.isFinite(estoque) && estoque >= 0 ? estoque : 0,
    tarja: typeof r.tarja === "boolean" ? r.tarja : null,
    categoria:
      typeof r.categoria === "string" && r.categoria.trim() ? r.categoria.trim() : null,
  };
}

type ExistingProduct = { id: string; sku: string | null; ean: string | null };

const decimalMoney = (value: number): string => {
  const cents = moneyToCents(value);
  if (cents === null) throw new TypeError("Preço inválido na integração.");
  return centsToDecimal(cents);
};
type WorkItem = {
  item: CatalogItem;
  product: ExistingProduct | null;
  /** Quantos registros do lote foram consolidados neste mesmo produto. */
  occurrences: number;
};

/** Reproduz o efeito de updates sequenciais: curadoria inicial é preservada. */
function mergeRepeatedItem(previous: CatalogItem, next: CatalogItem): CatalogItem {
  return {
    ...previous,
    preco: next.preco,
    promo: next.promo,
    estoque: next.estoque,
    ean: next.ean ?? previous.ean,
    tarja:
      previous.tarja === true || next.tarja === true
        ? true
        : (next.tarja ?? previous.tarja),
  };
}

function workItemsFor(
  items: CatalogItem[],
  existing: ExistingProduct[]
): WorkItem[] {
  const bySku = new Map(
    existing.flatMap((product) => (product.sku ? [[product.sku, product] as const] : []))
  );
  const byEan = new Map(
    existing.flatMap((product) => (product.ean ? [[product.ean, product] as const] : []))
  );
  const identityBySku = new Map<string, string>();
  const identityByEan = new Map<string, string>();
  const work = new Map<string, WorkItem>();

  for (const item of items) {
    const product = bySku.get(item.sku) ?? (item.ean ? byEan.get(item.ean) : undefined);
    let identity: string;
    if (product) {
      identity = `product:${product.id}`;
    } else {
      identity =
        identityBySku.get(item.sku) ??
        (item.ean ? identityByEan.get(item.ean) : undefined) ??
        `new:${work.size}`;
      identityBySku.set(item.sku, identity);
      if (item.ean) identityByEan.set(item.ean, identity);
    }

    const previous = work.get(identity);
    if (previous) {
      previous.item = mergeRepeatedItem(previous.item, item);
      previous.occurrences++;
    } else {
      work.set(identity, { item, product: product ?? null, occurrences: 1 });
    }
  }
  return [...work.values()];
}

async function preloadProducts(items: CatalogItem[]): Promise<ExistingProduct[]> {
  if (items.length === 0) return [];
  const skus = [...new Set(items.map((item) => item.sku))];
  const eans = [
    ...new Set(items.map((item) => item.ean).filter((ean): ean is string => !!ean)),
  ];
  return prisma.product.findMany({
    where: {
      OR: [
        { sku: { in: skus } },
        ...(eans.length > 0 ? [{ ean: { in: eans } }] : []),
      ],
    },
    select: { id: true, sku: true, ean: true },
  });
}

async function categoryIdsFor(items: WorkItem[]): Promise<Map<string, string>> {
  const definitions = new Map<string, string>();
  for (const { item } of items) {
    const name = item.categoria?.trim() || "Outros";
    definitions.set(slugify(name) || "outros", name);
  }
  const slugs = [...definitions.keys()];
  let categories = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const found = new Set(categories.map((category) => category.slug));
  const missing = slugs.filter((slug) => !found.has(slug));
  if (missing.length > 0) {
    await prisma.category.createMany({
      data: missing.map((slug) => ({
        slug,
        name: definitions.get(slug)!,
        sort: 999,
      })),
      skipDuplicates: true,
    });
    categories = await prisma.category.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    try {
      revalidateTag("categories", "max");
    } catch {
      // testes/execução fora de request não têm cache para invalidar
    }
  }
  const ids = new Map(categories.map((category) => [category.slug, category.id]));
  if (ids.size !== slugs.length) throw new Error("não foi possível preparar categorias");
  return ids;
}

function categoryIdFor(item: CatalogItem, categoryIds: Map<string, string>): string {
  const slug = slugify(item.categoria?.trim() || "Outros") || "outros";
  const id = categoryIds.get(slug);
  if (!id) throw new Error(`categoria indisponível: ${slug}`);
  return id;
}

async function updateExisting(
  pharmacyId: string,
  work: WorkItem
): Promise<void> {
  const product = work.product!;
  await prisma.product.update({
    where: { id: product.id },
    data: {
      price: decimalMoney(work.item.preco),
      promoPrice:
        work.item.promo == null ? null : decimalMoney(work.item.promo),
      ean: work.item.ean ?? product.ean,
      // Em match por EAN, vincula o SKU somente se o cadastro ainda não tinha um.
      sku: product.sku ?? work.item.sku,
      ...(work.item.tarja === true ? { requiresPrescription: true, active: false } : {}),
    },
  });
  await prisma.inventory.upsert({
    where: { productId_pharmacyId: { productId: product.id, pharmacyId } },
    update: { stock: work.item.estoque },
    create: { productId: product.id, pharmacyId, stock: work.item.estoque },
  });
}

async function createBatch(
  pharmacyId: string,
  batch: WorkItem[],
  categoryIds: Map<string, string>
): Promise<Set<string>> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.product.createManyAndReturn({
      data: batch.map(({ item }) => ({
        name: item.nome,
        slug: importedSlug(item.nome, item.sku),
        description: item.nome,
        sku: item.sku,
        ean: item.ean,
        price: decimalMoney(item.preco),
        promoPrice: item.promo == null ? null : decimalMoney(item.promo),
        requiresPrescription: item.tarja ?? false,
        active: false,
        categoryId: categoryIdFor(item, categoryIds),
      })),
      skipDuplicates: true,
      select: { id: true, sku: true },
    });
    if (created.length > 0) {
      const stockBySku = new Map(batch.map(({ item }) => [item.sku, item.estoque]));
      await tx.inventory.createMany({
        data: created.map((product) => ({
          productId: product.id,
          pharmacyId,
          stock: stockBySku.get(product.sku ?? "") ?? 0,
        })),
        skipDuplicates: true,
      });
    }
    return new Set(created.flatMap((product) => (product.sku ? [product.sku] : [])));
  });
}

/** Caminho isolado usado apenas se um lote sofrer corrida/erro de constraint. */
async function upsertOne(pharmacyId: string, item: CatalogItem): Promise<"created" | "updated"> {
  let product = await prisma.product.findUnique({ where: { sku: item.sku } });
  if (!product && item.ean) {
    product = await prisma.product.findFirst({ where: { ean: item.ean } });
  }
  if (product) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        price: decimalMoney(item.preco),
        promoPrice: item.promo == null ? null : decimalMoney(item.promo),
        ean: item.ean ?? product.ean,
        sku: product.sku ?? item.sku,
        ...(item.tarja === true ? { requiresPrescription: true, active: false } : {}),
      },
    });
    await prisma.inventory.upsert({
      where: { productId_pharmacyId: { productId: product.id, pharmacyId } },
      update: { stock: item.estoque },
      create: { productId: product.id, pharmacyId, stock: item.estoque },
    });
    return "updated";
  }

  product = await prisma.product.create({
    data: {
      name: item.nome,
      slug: await uniqueSlug(item.nome),
      description: item.nome,
      sku: item.sku,
      ean: item.ean,
      price: decimalMoney(item.preco),
      promoPrice: item.promo == null ? null : decimalMoney(item.promo),
      requiresPrescription: item.tarja ?? false,
      active: false,
      categoryId: await fallbackCategoryId(item.categoria),
    },
  });
  await prisma.inventory.upsert({
    where: { productId_pharmacyId: { productId: product.id, pharmacyId } },
    update: { stock: item.estoque },
    create: { productId: product.id, pharmacyId, stock: item.estoque },
  });
  return "created";
}

export async function upsertCatalog(
  pharmacyId: string,
  rawItems: unknown[]
): Promise<CatalogResult> {
  const result: CatalogResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const valid: CatalogItem[] = [];
  for (const raw of rawItems) {
    const item = validItem(raw);
    if (item) valid.push(item);
    else result.skipped++;
  }

  let work: WorkItem[];
  try {
    work = workItemsFor(valid, await preloadProducts(valid));
  } catch {
    // Se o preload falhar, conserva a tolerância a falha por item do conector.
    work = valid.map((item) => ({ item, product: null, occurrences: 1 }));
    // Falha de preload é excepcional; sequencial evita corrida entre SKUs
    // repetidos enquanto o caminho degradado tenta se recuperar.
    for (const { item } of work) {
      try {
        const operation = await upsertOne(pharmacyId, item);
        result[operation]++;
      } catch (err) {
        result.errors.push(`${item.sku}: ${err instanceof Error ? err.message : "erro"}`);
      }
    }
    revalidateProducts();
    return result;
  }

  const existing = work.filter((entry) => entry.product);
  for (const batch of chunksOf(existing, EXISTING_WRITE_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (entry) => {
        try {
          await updateExisting(pharmacyId, entry);
          result.updated += entry.occurrences;
        } catch (err) {
          result.errors.push(
            `${entry.item.sku}: ${err instanceof Error ? err.message : "erro"}`
          );
        }
      })
    );
  }

  const newItems = work.filter((entry) => !entry.product);
  if (newItems.length > 0) {
    let categoryIds: Map<string, string> | null = null;
    try {
      categoryIds = await categoryIdsFor(newItems);
    } catch {
      // A criação individual abaixo usa o upsert de categoria como fallback.
    }

    for (const batch of chunksOf(newItems, CREATE_BATCH_SIZE)) {
      let createdSkus: Set<string> | null = null;
      if (categoryIds) {
        try {
          createdSkus = await createBatch(pharmacyId, batch, categoryIds);
        } catch {
          // Transaction rollback: isola os itens para identificar o erro real.
        }
      }

      for (const entry of batch) {
        if (createdSkus?.has(entry.item.sku)) {
          result.created++;
          result.updated += entry.occurrences - 1;
          continue;
        }
        try {
          const operation = await upsertOne(pharmacyId, entry.item);
          result[operation]++;
          result.updated += entry.occurrences - 1;
        } catch (err) {
          result.errors.push(
            `${entry.item.sku}: ${err instanceof Error ? err.message : "erro"}`
          );
        }
      }
    }
  }

  // Preço/estoque mudaram — invalida as listas cacheadas da loja.
  // ("max" = revalida já; mesmo padrão de revalidateProductsSafe em orders.ts)
  revalidateProducts();
  return result;
}

function revalidateProducts(): void {
  try {
    revalidateTag("products", "max");
  } catch {
    // fora de contexto de request (testes) não há cache a invalidar
  }
}
