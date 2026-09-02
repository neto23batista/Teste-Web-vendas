import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";
import { resolveUnitFilter, ADMIN_PER_PAGE } from "@/lib/admin/scope";

export async function getAdminProducts(
  q?: string,
  page = 1,
  selectedUnitId?: string | null,
) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { ean: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const current = Math.max(1, page);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        inventory: {
          where: unit ? { pharmacyId: unit } : undefined,
          select: { stock: true, minStock: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);
  // Achata o estoque da unidade (ou soma de todas) para a tabela.
  const items = rows.map(({ inventory, ...p }) => ({
    ...p,
    price: moneyToNumber(p.price),
    promoPrice: p.promoPrice == null ? null : moneyToNumber(p.promoPrice),
    costPrice: p.costPrice == null ? null : moneyToNumber(p.costPrice),
    stock: inventory.reduce((s, i) => s + i.stock, 0),
    minStock: inventory[0]?.minStock ?? 5,
  }));
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

/** Linhas de estoque por unidade para a página de Controle de estoque. */
export async function getStockRows(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  // Sem unidade definida (matriz "todas"), usa a matriz como referência para
  // ajuste — o ajuste sempre age sobre UMA unidade concreta.
  const targetUnit =
    unit ??
    (
      await prisma.pharmacy.findFirst({
        where: { type: "MATRIZ", archivedAt: null },
        select: { id: true },
      })
    )?.id ??
    null;
  if (!targetUnit) return { unitId: null, rows: [] as StockRow[] };

  const rows = await prisma.inventory.findMany({
    where: { pharmacyId: targetUnit, product: { active: true } },
    select: {
      stock: true,
      minStock: true,
      price: true,
      promoPrice: true,
      costPrice: true,
      sku: true,
      ean: true,
      product: {
        select: {
          id: true,
          name: true,
          emoji: true,
          price: true,
          promoPrice: true,
          costPrice: true,
          sku: true,
          ean: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { stock: "asc" },
    take: 200,
  });
  return {
    unitId: targetUnit,
    rows: rows.map((r) => ({
      productId: r.product.id,
      name: r.product.name,
      emoji: r.product.emoji,
      category: r.product.category.name,
      stock: r.stock,
      minStock: r.minStock,
      price: moneyToNumber(r.price ?? r.product.price),
      promoPrice:
        (r.promoPrice ?? r.product.promoPrice) == null
          ? null
          : moneyToNumber(r.promoPrice ?? r.product.promoPrice!),
      costPrice:
        (r.costPrice ?? r.product.costPrice) == null
          ? null
          : moneyToNumber(r.costPrice ?? r.product.costPrice!),
      sku: r.sku ?? r.product.sku,
      ean: r.ean ?? r.product.ean,
    })),
  };
}

export type StockRow = {
  productId: string;
  name: string;
  emoji: string | null;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  promoPrice: number | null;
  costPrice: number | null;
  sku: string | null;
  ean: string | null;
};

export function getCategoriesAndBrands() {
  return Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
}
