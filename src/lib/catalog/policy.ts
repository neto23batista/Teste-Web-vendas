import type { Prisma } from "@prisma/client";

/**
 * Política comercial atual: a loja vende somente itens que não exigem receita.
 *
 * Este filtro deve acompanhar toda leitura pública de catálogo. Ele não substitui
 * a validação nas mutações: Server Actions continuam tratando IDs como entrada
 * não confiável e revalidam o produto antes de assinar/adicionar/comprar.
 */
export const SALEABLE_PRODUCT_WHERE = {
  active: true,
  requiresPrescription: false,
} satisfies Prisma.ProductWhereInput;

export const PRESCRIPTION_PRODUCT_UNAVAILABLE =
  "Medicamentos que exigem receita não são vendidos por este canal.";

export function isProductSaleable(product: {
  active: boolean;
  requiresPrescription: boolean;
}): boolean {
  return product.active && !product.requiresPrescription;
}
