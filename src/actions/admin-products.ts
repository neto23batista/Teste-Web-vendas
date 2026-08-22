"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdmin, requireAdminAtPharmacy } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { parseCsvRecords } from "@/lib/csv";
import { PRESCRIPTION_PRODUCT_UNAVAILABLE } from "@/lib/product-policy";
import {
  centsToDecimal,
  parseMoneyInputToCents,
} from "@/lib/money";
import { validateProductImageUrls } from "@/lib/product-images";

// Invalida o cache das listas de produto da home (tag "products").
function revalidateProducts() {
  revalidateTag("products", "max");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

// Catálogo e preços são compartilhados (globais) → só a matriz gerencia. Além do
// escopo (matriz), exige a ÁREA "produtos": o middleware protege a página, mas as
// Server Actions são invocáveis direto pelo id — sem esta checagem, um admin da
// matriz com perfil que não é de catálogo (farmacêutico/atendente) conseguiria
// criar/editar/excluir/importar produtos chamando a action na mão.
async function isCatalogAdmin(): Promise<boolean> {
  const user = await requireAdmin();
  return user.pharmacyType === "MATRIZ" && canAccess(user.staffProfile, "produtos");
}

/** Garante uma linha de Inventory em todas as unidades ativas (não zera estoque
 *  já existente). Usado ao criar produtos / ao surgir uma unidade nova. */
async function ensureInventoryForAllUnits(productId: string, minStock: number) {
  const pharmacies = await prisma.pharmacy.findMany({
    where: { active: true, archivedAt: null },
    select: { id: true },
  });
  for (const ph of pharmacies) {
    await prisma.inventory.upsert({
      where: { productId_pharmacyId: { productId, pharmacyId: ph.id } },
      create: { productId, pharmacyId: ph.id, stock: 0, minStock },
      update: {},
    });
  }
}

/** Estoque informado no formulário do produto = estoque da MATRIZ (filiais
 *  começam em 0 e gerenciam o próprio em Controle de estoque). */
async function setMatrizStock(productId: string, stock: number, minStock: number) {
  const matriz = await prisma.pharmacy.findFirst({
    where: { type: "MATRIZ", archivedAt: null },
    select: { id: true },
  });
  if (!matriz) return;
  await prisma.inventory.upsert({
    where: { productId_pharmacyId: { productId, pharmacyId: matriz.id } },
    create: { productId, pharmacyId: matriz.id, stock, minStock },
    update: { stock, minStock },
  });
}

export type ProductFormState = { error?: string } | undefined;

function parse(formData: FormData) {
  const raw = (key: string) => String(formData.get(key) ?? "").trim();
  const integer = (key: string, fallback: number) => {
    const value = raw(key);
    return value === "" ? fallback : Number(value);
  };
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    shortDescription: String(formData.get("shortDescription") ?? "").trim() || null,
    activeIngredient: String(formData.get("activeIngredient") ?? "").trim() || null,
    emoji: String(formData.get("emoji") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
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

function validateProductForm(d: ReturnType<typeof parse>):
  | { ok: true; imageUrls: string[] }
  | { ok: false; error: string } {
  if (!d.name || d.priceCents === null || !d.categoryId) {
    return { ok: false, error: "Nome, preço válido e categoria são obrigatórios." };
  }
  if (d.priceCents <= 0) return { ok: false, error: "O preço deve ser maior que zero." };
  if (d.promoPriceRaw && d.promoPriceCents === null) {
    return { ok: false, error: "Preço promocional inválido (use até 2 casas)." };
  }
  if (d.costPriceRaw && d.costPriceCents === null) {
    return { ok: false, error: "Custo inválido (use até 2 casas)." };
  }
  if (d.promoPriceCents !== null && (d.promoPriceCents <= 0 || d.promoPriceCents >= d.priceCents)) {
    return { ok: false, error: "O preço promocional deve ser menor que o preço normal." };
  }
  if (d.costPriceCents !== null && d.costPriceCents < 0) {
    return { ok: false, error: "O custo não pode ser negativo." };
  }
  if (!Number.isSafeInteger(d.stock) || d.stock < 0 || !Number.isSafeInteger(d.minStock) || d.minStock < 0) {
    return { ok: false, error: "Estoque e estoque mínimo devem ser inteiros não negativos." };
  }
  const images = validateProductImageUrls(d.imageUrlsRaw);
  return images.ok ? { ok: true, imageUrls: images.urls } : images;
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let slug = slugify(base) || "produto";
  let i = 1;
  while (true) {
    const found = await prisma.product.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  if (!(await isCatalogAdmin())) {
    return { error: "Apenas a matriz gerencia o catálogo de produtos." };
  }
  const d = parse(formData);
  const valid = validateProductForm(d);
  if (!valid.ok) return { error: valid.error };

  const product = await prisma.product.create({
    data: {
      name: d.name,
      slug: await uniqueSlug(d.name),
      description: d.description || d.name,
      shortDescription: d.shortDescription,
      activeIngredient: d.activeIngredient,
      emoji: d.emoji,
      sku: d.sku,
      price: centsToDecimal(d.priceCents!),
      promoPrice:
        d.promoPriceCents == null ? null : centsToDecimal(d.promoPriceCents),
      costPrice:
        d.costPriceCents == null ? null : centsToDecimal(d.costPriceCents),
      categoryId: d.categoryId,
      brandId: d.brandId,
      isGeneric: d.isGeneric,
      featured: d.featured,
      active: d.active,
      images: {
        create: valid.imageUrls.map((url, i) => ({ url, sort: i })),
      },
    },
  });
  // Cria estoque por unidade: matriz com o informado, filiais zeradas.
  await ensureInventoryForAllUnits(product.id, d.minStock);
  await setMatrizStock(product.id, d.stock, d.minStock);

  await logAudit({
    action: "product.create",
    entity: "Product",
    entityId: product.id,
    detail: `Criou o produto "${product.name}"`,
  });
  revalidateProducts();
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  if (!(await isCatalogAdmin())) {
    return { error: "Apenas a matriz gerencia o catálogo de produtos." };
  }
  const d = parse(formData);
  const valid = validateProductForm(d);
  if (!valid.ok) return { error: valid.error };

  const current = await prisma.product.findUnique({
    where: { id },
    select: { requiresPrescription: true },
  });
  if (!current) return { error: "Produto não encontrado." };

  await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      slug: await uniqueSlug(d.name, id),
      description: d.description || d.name,
      shortDescription: d.shortDescription,
      activeIngredient: d.activeIngredient,
      emoji: d.emoji,
      sku: d.sku,
      price: centsToDecimal(d.priceCents!),
      promoPrice:
        d.promoPriceCents == null ? null : centsToDecimal(d.promoPriceCents),
      costPrice:
        d.costPriceCents == null ? null : centsToDecimal(d.costPriceCents),
      categoryId: d.categoryId,
      brandId: d.brandId,
      isGeneric: d.isGeneric,
      featured: d.featured,
      // Mesmo uma chamada direta da Server Action não consegue republicar um
      // item classificado como sujeito a prescrição.
      active: current.requiresPrescription ? false : d.active,
      // Substitui o conjunto de imagens pelo informado no formulário.
      images: {
        deleteMany: {},
        create: valid.imageUrls.map((url, i) => ({ url, sort: i })),
      },
    },
  });
  // O campo de estoque do formulário reflete a MATRIZ; filiais usam Controle de
  // estoque. Garante linhas em todas as unidades (cobre unidades novas).
  await ensureInventoryForAllUnits(id, d.minStock);
  await setMatrizStock(id, d.stock, d.minStock);

  await logAudit({
    action: "product.update",
    entity: "Product",
    entityId: id,
    detail: `Editou o produto "${d.name}"`,
  });
  revalidateProducts();
  redirect("/admin/produtos");
}

export async function toggleProductActive(id: string) {
  if (!(await isCatalogAdmin())) return { ok: false, error: "Acesso negado." };
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, active: true, requiresPrescription: true },
  });
  if (product) {
    if (!product.active && product.requiresPrescription) {
      return { ok: false, error: PRESCRIPTION_PRODUCT_UNAVAILABLE };
    }
    await prisma.product.update({ where: { id }, data: { active: !product.active } });
    await logAudit({
      action: "product.toggle",
      entity: "Product",
      entityId: id,
      detail: `${product.active ? "Desativou" : "Ativou"} o produto "${product.name}"`,
    });
    revalidateProducts();
  }
  return product
    ? { ok: true }
    : { ok: false, error: "Produto não encontrado." };
}

export async function deleteProduct(id: string) {
  if (!(await isCatalogAdmin())) return { ok: false };
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  // Só registra na auditoria (e reporta sucesso) se o delete de fato ocorreu.
  const deleted = await prisma.product
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (deleted) {
    await logAudit({
      action: "product.delete",
      entity: "Product",
      entityId: id,
      detail: `Excluiu o produto "${product?.name ?? id}"`,
    });
    revalidateProducts();
  }
  return { ok: deleted };
}

// ─────────────────────── Importação de catálogo (CSV) ───────────────────────

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: string[];
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const csvNum = (v: string): number | null => {
  const t = (v ?? "").replace(/\./g, "").replace(",", ".").trim();
  // Aceita "1.299,90" (pt-BR) e "1299.90". Remove separador de milhar só se
  // houver vírgula decimal; senão usa o ponto como decimal.
  const plain = (v ?? "").replace(",", ".").trim();
  const candidate = /,/.test(v ?? "") ? t : plain;
  if (candidate === "") return null;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : null;
};

const csvMoneyCents = (value: string): number | null => {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const normalized = /,/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return parseMoneyInputToCents(normalized);
};

const csvBool = (v: string): boolean =>
  ["sim", "s", "true", "1", "x", "yes"].includes((v ?? "").trim().toLowerCase());

const CSV_IMPORT_MAX_ROWS = 2_000;
const CSV_IMPORT_BATCH_SIZE = 100;
const CSV_IMPORT_CONCURRENCY = 20;
const CSV_INVENTORY_BATCH_SIZE = 1_000;

type CsvProductData = {
  name: string;
  description: string;
  activeIngredient: string | null;
  ean: string | null;
  price: string;
  promoPrice: string | null;
  categoryId: string;
  brandId: string | null;
  isGeneric: boolean;
};

type CsvWorkItem = {
  line: number;
  sku: string | null;
  stock: number;
  requiresPrescription: boolean;
  data: CsvProductData;
  occurrences: number;
  existing: { id: string; requiresPrescription: boolean } | null;
};

function csvChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function csvImportSlug(name: string, identity: string): string {
  const base = (slugify(name) || "produto").slice(0, 65);
  const suffix = createHash("sha256").update(identity).digest("hex").slice(0, 12);
  return `${base}-${suffix}`;
}

export async function importProducts(formData: FormData): Promise<ImportResult> {
  if (!(await isCatalogAdmin())) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["Apenas a matriz importa o catálogo."],
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, created: 0, updated: 0, errors: ["Selecione um arquivo CSV."] };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, created: 0, updated: 0, errors: ["Arquivo muito grande (máx. 2 MB)."] };
  }

  const text = await file.text();
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["CSV vazio ou sem linhas de dados (verifique o cabeçalho)."],
    };
  }
  if (records.length > CSV_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: [
        `CSV com linhas demais (máx. ${CSV_IMPORT_MAX_ROWS.toLocaleString("pt-BR")}). Divida o arquivo em lotes.`,
      ],
    };
  }

  // Pré-carrega categorias e marcas e indexa por nome e slug normalizados.
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(norm(c.name), c.id);
    catMap.set(norm(c.slug), c.id);
  }
  const brandMap = new Map<string, string>();
  for (const b of brands) {
    brandMap.set(norm(b.name), b.id);
    brandMap.set(norm(b.slug), b.id);
  }

  const errors: string[] = [];
  const prepared: Omit<CsvWorkItem, "occurrences" | "existing">[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const line = i + 2; // +1 pelo cabeçalho, +1 para base-1
    const name = (r.nome ?? "").trim();
    const sku = (r.sku ?? "").trim() || null;

    if (!name) {
      errors.push(`Linha ${line}: nome em branco — ignorada.`);
      continue;
    }
    const priceCents = csvMoneyCents(r.preco ?? "");
    if (priceCents === null || priceCents <= 0) {
      errors.push(`Linha ${line} (${name}): preço inválido — ignorada.`);
      continue;
    }
    const promoRaw = (r.promo ?? "").trim();
    const promoCents = promoRaw ? csvMoneyCents(promoRaw) : null;
    if (
      promoRaw &&
      (promoCents === null || promoCents <= 0 || promoCents >= priceCents)
    ) {
      errors.push(
        `Linha ${line} (${name}): promoção inválida ou maior que o preço — ignorada.`
      );
      continue;
    }

    const catKey = norm(r.categoria ?? "");
    const categoryId = catKey ? catMap.get(catKey) : undefined;
    if (!categoryId) {
      errors.push(
        `Linha ${line} (${name}): categoria "${r.categoria ?? ""}" não encontrada — ignorada.`
      );
      continue;
    }

    let brandId: string | null = null;
    const brandKey = norm(r.marca ?? "");
    if (brandKey) {
      const found = brandMap.get(brandKey);
      if (!found) {
        errors.push(
          `Linha ${line} (${name}): marca "${r.marca}" não encontrada — ignorada.`
        );
        continue;
      }
      brandId = found;
    }

    // Estoque do CSV vai para o Inventory da matriz (não mais para o Product).
    const csvStock = Math.max(0, Math.round(csvNum(r.estoque ?? "") ?? 0));
    // Importação nunca rebaixa automaticamente um item já classificado como
    // sujeito a prescrição. `tarja=sim` só pode tornar a política mais restrita.
    const requiresPrescription = csvBool(r.tarja ?? "");
    const data: CsvProductData = {
      name,
      description: (r.descricao ?? "").trim() || name,
      activeIngredient: (r.principio_ativo ?? "").trim() || null,
      ean: (r.ean ?? "").trim() || null,
      price: centsToDecimal(priceCents),
      promoPrice: promoCents == null ? null : centsToDecimal(promoCents),
      categoryId,
      brandId,
      isGeneric: csvBool(r.generico ?? ""),
    };
    prepared.push({ line, sku, stock: csvStock, requiresPrescription, data });
  }

  if (prepared.length === 0) return { ok: true, created: 0, updated: 0, errors };

  // Uma consulta substitui o findUnique por linha. Unidade e matriz também são
  // resolvidas uma única vez, em vez de serem relidas para cada produto.
  const skus = [
    ...new Set(prepared.map((entry) => entry.sku).filter((sku): sku is string => !!sku)),
  ];
  const [existingProducts, activePharmacies, matriz] = await Promise.all([
    skus.length > 0
      ? prisma.product.findMany({
          where: { sku: { in: skus } },
          select: { id: true, sku: true, requiresPrescription: true },
        })
      : Promise.resolve([]),
    prisma.pharmacy.findMany({
      where: { active: true, archivedAt: null },
      select: { id: true },
    }),
    prisma.pharmacy.findFirst({
      where: { type: "MATRIZ", archivedAt: null },
      select: { id: true },
    }),
  ]);
  const existingBySku = new Map(
    existingProducts.flatMap((product) =>
      product.sku ? [[product.sku, product] as const] : []
    )
  );
  const unitIds = [
    ...new Set([
      ...activePharmacies.map((pharmacy) => pharmacy.id),
      ...(matriz ? [matriz.id] : []),
    ]),
  ];

  // Consolida SKU repetido: o último registro vence nos dados/estoque, enquanto
  // `tarja=sim` nunca é rebaixado por uma linha posterior.
  const consolidated = new Map<string, CsvWorkItem>();
  for (const entry of prepared) {
    const key = entry.sku ? `sku:${entry.sku}` : `line:${entry.line}`;
    const previous = consolidated.get(key);
    if (previous) {
      previous.line = entry.line;
      previous.stock = entry.stock;
      previous.data = entry.data;
      previous.requiresPrescription ||= entry.requiresPrescription;
      previous.occurrences++;
      continue;
    }
    consolidated.set(key, {
      ...entry,
      occurrences: 1,
      existing: entry.sku
        ? (() => {
            const product = existingBySku.get(entry.sku!);
            return product
              ? { id: product.id, requiresPrescription: product.requiresPrescription }
              : null;
          })()
        : null,
    });
  }

  let created = 0;
  let updated = 0;
  const work = [...consolidated.values()];
  const existing = work.filter(
    (entry): entry is CsvWorkItem & { existing: NonNullable<CsvWorkItem["existing"]> } =>
      entry.existing != null
  );

  for (const batch of csvChunks(existing, CSV_IMPORT_CONCURRENCY)) {
    let inventoriesPrepared = true;
    if (unitIds.length > 0) {
      try {
        const inventoryRows = batch.flatMap((entry) =>
          unitIds.map((pharmacyId) => ({
            productId: entry.existing.id,
            pharmacyId,
            stock: 0,
            minStock: 5,
          }))
        );
        for (const rows of csvChunks(inventoryRows, CSV_INVENTORY_BATCH_SIZE)) {
          await prisma.inventory.createMany({ data: rows, skipDuplicates: true });
        }
      } catch {
        inventoriesPrepared = false;
      }
    }

    await Promise.all(
      batch.map(async (entry) => {
        try {
          const restrictive =
            entry.requiresPrescription || entry.existing.requiresPrescription;
          const update = prisma.product.update({
            where: { id: entry.existing.id },
            data: {
              ...entry.data,
              ...(restrictive ? { requiresPrescription: true, active: false } : {}),
            },
          });
          if (matriz) {
            await prisma.$transaction([
              update,
              prisma.inventory.upsert({
                where: {
                  productId_pharmacyId: {
                    productId: entry.existing.id,
                    pharmacyId: matriz.id,
                  },
                },
                create: {
                  productId: entry.existing.id,
                  pharmacyId: matriz.id,
                  stock: entry.stock,
                  minStock: 5,
                },
                update: { stock: entry.stock, minStock: 5 },
              }),
            ]);
          } else {
            await update;
          }
          if (!inventoriesPrepared) {
            await ensureInventoryForAllUnits(entry.existing.id, 5);
          }
          updated += entry.occurrences;
        } catch (err) {
          errors.push(
            `Linha ${entry.line} (${entry.data.name}): falha ao salvar (${String(err)}).`
          );
        }
      })
    );
  }

  const newItems = work.filter((entry) => !entry.existing);
  for (const batch of csvChunks(newItems, CSV_IMPORT_BATCH_SIZE)) {
    const inserts = batch.map((entry) => {
      const id = randomUUID();
      return {
        entry,
        id,
        product: {
          id,
          ...entry.data,
          sku: entry.sku,
          slug: csvImportSlug(entry.data.name, entry.sku ?? id),
          requiresPrescription: entry.requiresPrescription,
          // Todo item importado passa por curadoria; itens de receita nunca
          // podem ser publicados enquanto a política MIP-only estiver vigente.
          active: false,
        },
      };
    });

    let batchCreated = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.product.createMany({ data: inserts.map((item) => item.product) });
        if (unitIds.length > 0) {
          const inventoryRows = inserts.flatMap(({ entry, id }) =>
            unitIds.map((pharmacyId) => ({
              productId: id,
              pharmacyId,
              stock: pharmacyId === matriz?.id ? entry.stock : 0,
              minStock: 5,
            }))
          );
          for (const rows of csvChunks(inventoryRows, CSV_INVENTORY_BATCH_SIZE)) {
            await tx.inventory.createMany({ data: rows });
          }
        }
      });
      batchCreated = true;
    } catch {
      // O lote é atômico. Em colisão/constraint, isola abaixo cada linha.
    }

    if (batchCreated) {
      created += batch.length;
      updated += batch.reduce((sum, entry) => sum + entry.occurrences - 1, 0);
      continue;
    }

    for (const { entry, id, product } of inserts) {
      try {
        const concurrent = entry.sku
          ? await prisma.product.findUnique({
              where: { sku: entry.sku },
              select: { id: true, requiresPrescription: true },
            })
          : null;
        if (concurrent) {
          await prisma.product.update({
            where: { id: concurrent.id },
            data: {
              ...entry.data,
              ...(entry.requiresPrescription || concurrent.requiresPrescription
                ? { requiresPrescription: true, active: false }
                : {}),
            },
          });
          await ensureInventoryForAllUnits(concurrent.id, 5);
          await setMatrizStock(concurrent.id, entry.stock, 5);
          updated += entry.occurrences;
          continue;
        }
        await prisma.$transaction(async (tx) => {
          await tx.product.create({
            data: {
              ...product,
              // O batch pode ter falhado por colisão de slug. No fallback,
              // usa um novo sufixo sem abrir uma consulta adicional.
              slug: csvImportSlug(entry.data.name, randomUUID()),
            },
          });
          if (unitIds.length > 0) {
            const inventoryRows = unitIds.map((pharmacyId) => ({
              productId: id,
              pharmacyId,
              stock: pharmacyId === matriz?.id ? entry.stock : 0,
              minStock: 5,
            }));
            for (const rows of csvChunks(inventoryRows, CSV_INVENTORY_BATCH_SIZE)) {
              await tx.inventory.createMany({ data: rows });
            }
          }
        });
        created++;
        updated += entry.occurrences - 1;
      } catch (err) {
        errors.push(
          `Linha ${entry.line} (${entry.data.name}): falha ao salvar (${String(err)}).`
        );
      }
    }
  }

  if (created > 0 || updated > 0) revalidateProducts();

  return { ok: true, created, updated, errors };
}

export async function adjustStock(
  productId: string,
  pharmacyId: string,
  delta: number
) {
  await assertArea("estoque");
  // Filial só ajusta a própria unidade; matriz, qualquer uma.
  await requireAdminAtPharmacy(pharmacyId);
  const inv = await prisma.inventory.findUnique({
    where: { productId_pharmacyId: { productId, pharmacyId } },
  });
  if (inv) {
    await prisma.inventory.update({
      where: { id: inv.id },
      data: { stock: Math.max(0, inv.stock + delta) },
    });
  } else {
    await prisma.inventory.create({
      data: { productId, pharmacyId, stock: Math.max(0, delta), minStock: 5 },
    });
  }
  revalidateProducts();
  revalidatePath("/admin/estoque");
  return { ok: true };
}

/**
 * Transfere `qty` de um produto entre unidades (rebalanceamento/reposição).
 * Atômico e anti-corrida: baixa condicional na origem (só move se houver saldo)
 * e soma no destino (cria a linha se faltar). Só a matriz move estoque entre
 * unidades.
 */
export async function transferStock(
  productId: string,
  fromPharmacyId: string,
  toPharmacyId: string,
  qty: number
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCatalogAdmin())) {
    return { ok: false, error: "Apenas a matriz transfere estoque entre unidades." };
  }
  if (fromPharmacyId === toPharmacyId) {
    return { ok: false, error: "Escolha unidades de origem e destino diferentes." };
  }
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Informe uma quantidade válida." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const taken = await tx.inventory.updateMany({
        where: { productId, pharmacyId: fromPharmacyId, stock: { gte: n } },
        data: { stock: { decrement: n } },
      });
      if (taken.count === 0) {
        throw new Error("Estoque insuficiente na unidade de origem.");
      }
      const dest = await tx.inventory.updateMany({
        where: { productId, pharmacyId: toPharmacyId },
        data: { stock: { increment: n } },
      });
      if (dest.count === 0) {
        await tx.inventory.create({
          data: { productId, pharmacyId: toPharmacyId, stock: n, minStock: 5 },
        });
      }
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao transferir estoque.",
    };
  }

  await logAudit({
    action: "stock.transfer",
    entity: "Product",
    entityId: productId,
    detail: `Transferiu ${n} un entre unidades`,
    pharmacyId: toPharmacyId,
  });
  revalidateProducts();
  revalidatePath("/admin/estoque");
  return { ok: true };
}
