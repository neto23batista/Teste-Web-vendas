"use server";

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import {
  syncCatalogInventory,
  recordInitialCatalogStock,
} from "@/lib/inventory/catalog-stock";
import { InventoryLotBalanceError } from "@/lib/inventory/lots";
import { reportError } from "@/lib/monitoring";
import { slugify } from "@/lib/utils";
import { parseCsvRecords } from "@/lib/csv";
import { centsToDecimal, parseMoneyInputToCents } from "@/lib/money";
import { type UnitOfferInput } from "@/lib/catalog/product-form";
import {
  isCatalogAdmin,
  ensureInventoryForAllUnits,
  syncMatrizOffer,
  revalidateProducts,
} from "@/lib/catalog/admin-support";

// ─────────────────────── Importação de catálogo (CSV) ───────────────────────

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: string[];
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

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
  ["sim", "s", "true", "1", "x", "yes"].includes(
    (v ?? "").trim().toLowerCase(),
  );

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
  stock: number | undefined;
  requiresPrescription: boolean;
  data: CsvProductData;
  occurrences: number;
  existing: { id: string; requiresPrescription: boolean } | null;
};

function csvUnitOffer(
  entry: Pick<CsvWorkItem, "sku" | "data">,
): UnitOfferInput {
  return {
    price: entry.data.price,
    costPrice: null,
    promoPrice: entry.data.promoPrice,
    sku: entry.sku,
    ean: entry.data.ean,
  };
}

function csvChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function csvImportSlug(name: string, identity: string): string {
  const base = (slugify(name) || "produto").slice(0, 65);
  const suffix = createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 12);
  return `${base}-${suffix}`;
}

export async function importProducts(
  formData: FormData,
): Promise<ImportResult> {
  if (!(await isCatalogAdmin())) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["Apenas a matriz importa o catálogo."],
    };
  }

  const actor = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["Selecione um arquivo CSV."],
    };
  }
  if (file.size > 2 * 1024 * 1024) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: ["Arquivo muito grande (máx. 2 MB)."],
    };
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
    const ean = (r.ean ?? "").replace(/\s+/g, "") || null;

    if (!name) {
      errors.push(`Linha ${line}: nome em branco — ignorada.`);
      continue;
    }
    if (ean && !/^\d{8,14}$/.test(ean)) {
      errors.push(`Linha ${line} (${name}): EAN inválido — ignorada.`);
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
        `Linha ${line} (${name}): promoção inválida ou maior que o preço — ignorada.`,
      );
      continue;
    }

    const catKey = norm(r.categoria ?? "");
    const categoryId = catKey ? catMap.get(catKey) : undefined;
    if (!categoryId) {
      errors.push(
        `Linha ${line} (${name}): categoria "${r.categoria ?? ""}" não encontrada — ignorada.`,
      );
      continue;
    }

    let brandId: string | null = null;
    const brandKey = norm(r.marca ?? "");
    if (brandKey) {
      const found = brandMap.get(brandKey);
      if (!found) {
        errors.push(
          `Linha ${line} (${name}): marca "${r.marca}" não encontrada — ignorada.`,
        );
        continue;
      }
      brandId = found;
    }

    // Vazio preserva o saldo existente; zero só é aplicado quando explícito.
    // Contagens inválidas não podem ser arredondadas nem convertidas em zero.
    const stockRaw = (r.estoque ?? "").trim();
    const csvStock = stockRaw ? csvNum(stockRaw) : undefined;
    if (
      csvStock !== undefined &&
      (csvStock === null ||
        !Number.isSafeInteger(csvStock) ||
        csvStock < 0 ||
        csvStock > 2_147_483_647)
    ) {
      errors.push(
        `Linha ${line} (${name}): estoque inválido; informe um inteiro entre 0 e 2147483647 ou deixe vazio — ignorada.`,
      );
      continue;
    }
    // Importação nunca rebaixa automaticamente um item já classificado como
    // sujeito a prescrição. `tarja=sim` só pode tornar a política mais restrita.
    const requiresPrescription = csvBool(r.tarja ?? "");
    const data: CsvProductData = {
      name,
      description: (r.descricao ?? "").trim() || name,
      activeIngredient: (r.principio_ativo ?? "").trim() || null,
      ean,
      price: centsToDecimal(priceCents),
      promoPrice: promoCents == null ? null : centsToDecimal(promoCents),
      categoryId,
      brandId,
      isGeneric: csvBool(r.generico ?? ""),
    };
    prepared.push({ line, sku, stock: csvStock, requiresPrescription, data });
  }

  if (prepared.length === 0)
    return { ok: true, created: 0, updated: 0, errors };

  // Uma consulta substitui o findUnique por linha. Unidade e matriz também são
  // resolvidas uma única vez, em vez de serem relidas para cada produto.
  const skus = [
    ...new Set(
      prepared.map((entry) => entry.sku).filter((sku): sku is string => !!sku),
    ),
  ];
  const eans = [
    ...new Set(
      prepared
        .map((entry) => entry.data.ean)
        .filter((ean): ean is string => !!ean),
    ),
  ];
  const [existingProducts, activePharmacies, matriz] = await Promise.all([
    skus.length > 0 || eans.length > 0
      ? prisma.product.findMany({
          where: {
            OR: [
              ...(skus.length > 0 ? [{ sku: { in: skus } }] : []),
              ...(eans.length > 0 ? [{ ean: { in: eans } }] : []),
            ],
          },
          select: {
            id: true,
            sku: true,
            ean: true,
            requiresPrescription: true,
          },
        })
      : Promise.resolve([]),
    prisma.pharmacy.findMany({
      where: { active: true, archivedAt: null },
      select: { id: true },
    }),
    prisma.pharmacy.findFirst({
      where: { type: "MATRIZ", active: true, archivedAt: null },
      select: { id: true },
    }),
  ]);
  const existingBySku = new Map(
    existingProducts.flatMap((product) =>
      product.sku ? [[product.sku, product] as const] : [],
    ),
  );
  const existingByEan = new Map(
    existingProducts.flatMap((product) =>
      product.ean ? [[product.ean, product] as const] : [],
    ),
  );
  const unitIds = [
    ...new Set([
      ...activePharmacies.map((pharmacy) => pharmacy.id),
      ...(matriz ? [matriz.id] : []),
    ]),
  ];

  // Consolida SKU repetido: os últimos dados e a última contagem explícita
  // vencem, enquanto `tarja=sim` nunca é rebaixado por uma linha posterior.
  const consolidated = new Map<string, CsvWorkItem>();
  for (const entry of prepared) {
    const matched =
      (entry.sku ? existingBySku.get(entry.sku) : undefined) ??
      (entry.data.ean ? existingByEan.get(entry.data.ean) : undefined);
    const key = matched
      ? `product:${matched.id}`
      : entry.data.ean
        ? `ean:${entry.data.ean}`
        : entry.sku
          ? `sku:${entry.sku}`
          : `line:${entry.line}`;
    const previous = consolidated.get(key);
    if (previous) {
      previous.line = entry.line;
      previous.sku = entry.sku;
      previous.stock = entry.stock ?? previous.stock;
      previous.data = entry.data;
      previous.requiresPrescription ||= entry.requiresPrescription;
      previous.occurrences++;
      continue;
    }
    consolidated.set(key, {
      ...entry,
      occurrences: 1,
      existing: matched
        ? { id: matched.id, requiresPrescription: matched.requiresPrescription }
        : null,
    });
  }

  let created = 0;
  let updated = 0;
  const work = [...consolidated.values()];
  const existing = work.filter(
    (
      entry,
    ): entry is CsvWorkItem & {
      existing: NonNullable<CsvWorkItem["existing"]>;
    } => entry.existing != null,
  );

  for (const batch of csvChunks(existing, CSV_IMPORT_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const restrictive =
            entry.requiresPrescription || entry.existing.requiresPrescription;
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: entry.existing.id },
              data: {
                ...entry.data,
                ...(restrictive
                  ? { requiresPrescription: true, active: false }
                  : {}),
              },
            });
            // Não prepara ofertas fora da transação: uma linha rejeitada
            // também precisa reverter a criação de inventários ausentes.
            const inventoryRows = unitIds.map((pharmacyId) => ({
              productId: entry.existing.id,
              pharmacyId,
              stock: 0,
              minStock: 5,
              ...csvUnitOffer(entry),
            }));
            for (const rows of csvChunks(
              inventoryRows,
              CSV_INVENTORY_BATCH_SIZE,
            )) {
              await tx.inventory.createMany({
                data: rows,
                skipDuplicates: true,
              });
            }
            if (matriz) {
              await syncCatalogInventory(tx, {
                productId: entry.existing.id,
                pharmacyId: matriz.id,
                stock: entry.stock,
                minStock: 5,
                offer: csvUnitOffer(entry),
                actor,
                reason: "Contagem pela importação CSV de catálogo",
              });
            }
          });
          updated += entry.occurrences;
        } catch (err) {
          if (!(err instanceof InventoryLotBalanceError))
            reportError(err, { operation: "catalog.import" });
          errors.push(
            `Linha ${entry.line} (${entry.data.name}): falha ao salvar (${err instanceof InventoryLotBalanceError ? err.message : "erro interno; tente novamente"}).`,
          );
        }
      }),
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
        await tx.product.createMany({
          data: inserts.map((item) => item.product),
        });
        if (unitIds.length > 0) {
          const inventoryRows = inserts.flatMap(({ entry, id }) =>
            unitIds.map((pharmacyId) => ({
              productId: id,
              pharmacyId,
              stock: pharmacyId === matriz?.id ? (entry.stock ?? 0) : 0,
              minStock: 5,
              ...csvUnitOffer(entry),
            })),
          );
          for (const rows of csvChunks(
            inventoryRows,
            CSV_INVENTORY_BATCH_SIZE,
          )) {
            await tx.inventory.createMany({ data: rows });
            await recordInitialCatalogStock(tx, rows, actor);
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
        const concurrent =
          entry.sku || entry.data.ean
            ? await prisma.product.findFirst({
                where: {
                  OR: [
                    ...(entry.sku ? [{ sku: entry.sku }] : []),
                    ...(entry.data.ean ? [{ ean: entry.data.ean }] : []),
                  ],
                },
                select: { id: true, requiresPrescription: true },
              })
            : null;
        if (concurrent) {
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: concurrent.id },
              data: {
                ...entry.data,
                ...(entry.requiresPrescription ||
                concurrent.requiresPrescription
                  ? { requiresPrescription: true, active: false }
                  : {}),
              },
            });
            const offer = csvUnitOffer(entry);
            await ensureInventoryForAllUnits(tx, concurrent.id, 5, offer);
            await syncMatrizOffer(
              tx,
              concurrent.id,
              5,
              offer,
              actor,
              entry.stock,
            );
          });
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
              stock: pharmacyId === matriz?.id ? (entry.stock ?? 0) : 0,
              minStock: 5,
              ...csvUnitOffer(entry),
            }));
            for (const rows of csvChunks(
              inventoryRows,
              CSV_INVENTORY_BATCH_SIZE,
            )) {
              await tx.inventory.createMany({ data: rows });
              await recordInitialCatalogStock(tx, rows, actor);
            }
          }
        });
        created++;
        updated += entry.occurrences - 1;
      } catch (err) {
        if (!(err instanceof InventoryLotBalanceError))
          reportError(err, { operation: "catalog.import" });
        errors.push(
          `Linha ${entry.line} (${entry.data.name}): falha ao salvar (${err instanceof InventoryLotBalanceError ? err.message : "erro interno; tente novamente"}).`,
        );
      }
    }
  }

  if (created > 0 || updated > 0) revalidateProducts();

  return { ok: true, created, updated, errors };
}
