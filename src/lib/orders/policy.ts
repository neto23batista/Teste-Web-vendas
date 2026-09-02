import type { OrderStatus } from "@prisma/client";
import {
  moneyToCents as exactMoneyToCents,
  type MoneyValue,
} from "@/lib/money";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
];

/**
 * Fluxo operacional permitido. O primeiro avanço depende do meio de pagamento:
 * dinheiro reserva estoque e entra em preparo, mas só vira pago na entrega.
 */
export function allowedOrderTransitions(
  current: OrderStatus,
  paymentMethod?: string | null,
): readonly OrderStatus[] {
  switch (current) {
    case "PENDING":
      return paymentMethod === "cash"
        ? ["PREPARING", "CANCELED"]
        : ["PAID", "CANCELED"];
    case "PAID":
      return ["PREPARING", "CANCELED"];
    case "PREPARING":
      return ["SHIPPED", "CANCELED"];
    case "SHIPPED":
      return ["DELIVERED"];
    case "DELIVERED":
    case "CANCELED":
      return [];
  }
}

export function isValidOrderTransition(
  current: OrderStatus,
  next: OrderStatus,
  paymentMethod?: string | null,
): boolean {
  return allowedOrderTransitions(current, paymentMethod).includes(next);
}

/**
 * Limite de varejo por produto em uma única compra.
 *
 * Além de evitar enganos na interface, o limite reduz o impacto de chamadas
 * diretas às Server Actions. Quantidade vinda do cliente nunca é confiável.
 */
export const MAX_ITEM_QUANTITY = 99;

export function isValidItemQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_ITEM_QUANTITY
  );
}

export function isValidStock(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

type OrderLineForValidation = {
  productId: unknown;
  name: unknown;
  price: unknown;
  qty: unknown;
};

type OrderFinancialsForValidation = {
  subtotal: unknown;
  shipping: unknown;
  discount: unknown;
  total: unknown;
  items: readonly OrderLineForValidation[];
};

/** Converte um valor monetário não negativo em centavos seguros. */
export function moneyToCents(value: unknown): number | null {
  return exactMoneyToCents(value as MoneyValue);
}

/**
 * Valida linhas e totais sem confiar no chamador. A comparação é feita em
 * centavos para não transformar ruído de ponto flutuante em falso positivo.
 */
export function validateOrderFinancials(
  input: OrderFinancialsForValidation,
): string | null {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return "O pedido precisa ter ao menos um item.";
  }

  const productIds = new Set<string>();
  let itemsSubtotalCents = 0;
  for (const item of input.items) {
    if (typeof item.productId !== "string" || !item.productId.trim()) {
      return "O pedido contém um produto inválido.";
    }
    if (productIds.has(item.productId)) {
      return "O pedido contém produtos duplicados.";
    }
    productIds.add(item.productId);

    if (typeof item.name !== "string" || !item.name.trim()) {
      return "O pedido contém um item sem nome.";
    }
    if (!isValidItemQuantity(item.qty)) {
      return `Quantidade inválida para "${item.name}".`;
    }

    const priceCents = moneyToCents(item.price);
    if (priceCents === null) {
      return `Preço inválido para "${item.name}".`;
    }
    const lineTotalCents = priceCents * item.qty;
    if (
      !Number.isSafeInteger(lineTotalCents) ||
      itemsSubtotalCents > Number.MAX_SAFE_INTEGER - lineTotalCents
    ) {
      return "O valor dos itens ultrapassa o limite permitido.";
    }
    itemsSubtotalCents += lineTotalCents;
  }

  const subtotalCents = moneyToCents(input.subtotal);
  const shippingCents = moneyToCents(input.shipping);
  const discountCents = moneyToCents(input.discount);
  const totalCents = moneyToCents(input.total);
  if (
    subtotalCents === null ||
    shippingCents === null ||
    discountCents === null ||
    totalCents === null
  ) {
    return "O pedido contém um total inválido.";
  }
  if (subtotalCents !== itemsSubtotalCents) {
    return "O subtotal diverge dos itens do pedido.";
  }
  if (discountCents > subtotalCents) {
    return "O desconto ultrapassa o subtotal do pedido.";
  }
  if (totalCents !== subtotalCents - discountCents + shippingCents) {
    return "O total diverge do subtotal, desconto e frete.";
  }
  return null;
}

export function assertValidInventoryItems(
  items: readonly OrderLineForValidation[],
) {
  for (const item of items) {
    if (!isValidItemQuantity(item.qty)) {
      const name = typeof item.name === "string" ? item.name : "item";
      throw new Error(`Pedido inválido: quantidade inválida para "${name}".`);
    }
    if (typeof item.productId !== "string" || !item.productId) {
      throw new Error("Pedido inválido: item sem produto vinculado.");
    }
  }
}
