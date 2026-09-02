import { Prisma } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";

/** Campos do card, exceto o estoque (que agora é por unidade — ver Inventory). */
const productCardBase = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  price: true,
  promoPrice: true,
  isGeneric: true,
  rating: true,
  ratingCount: true,
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true } },
  images: { select: { url: true }, orderBy: { sort: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

/**
 * Select do card de produto com o estoque da unidade informada. Sem unidade
 * (null), traz o estoque de todas e o mapper soma (visão agregada).
 */
export function productCardSelect(pharmacyId?: string | null) {
  return {
    ...productCardBase,
    inventory: {
      where: pharmacyId ? { pharmacyId } : undefined,
      select: { stock: true, price: true, promoPrice: true },
    },
  } satisfies Prisma.ProductSelect;
}

type ProductCardRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof productCardSelect>;
}>;

/** Card com o estoque já achatado em `stock` (da unidade selecionada). */
export type ProductCard = Omit<
  ProductCardRow,
  "inventory" | "price" | "promoPrice"
> & {
  price: number;
  promoPrice: number | null;
  stock: number;
};

export function toProductCard(row: ProductCardRow): ProductCard {
  const { inventory, ...rest } = row;
  const stock = inventory.reduce((sum, i) => sum + i.stock, 0);
  const unitOffer = inventory.length === 1 ? inventory[0] : null;
  const effectivePrice = unitOffer?.price ?? rest.price;
  const effectivePromo = unitOffer?.promoPrice ?? rest.promoPrice;
  return {
    ...rest,
    price: moneyToNumber(effectivePrice),
    promoPrice: effectivePromo == null ? null : moneyToNumber(effectivePromo),
    stock,
  };
}
