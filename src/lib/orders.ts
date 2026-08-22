import { revalidateTag } from "next/cache";
import type { Prisma, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";
import {
  centsToDecimal,
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
  paymentMethod?: string | null
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
  paymentMethod?: string | null
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
function moneyToCents(value: unknown): number | null {
  return exactMoneyToCents(value as MoneyValue);
}

/**
 * Valida linhas e totais sem confiar no chamador. A comparação é feita em
 * centavos para não transformar ruído de ponto flutuante em falso positivo.
 */
export function validateOrderFinancials(
  input: OrderFinancialsForValidation
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

function assertValidInventoryItems(items: readonly OrderLineForValidation[]) {
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

/**
 * Reivindica uma transição de status de forma ATÔMICA: o UPDATE só "pega" se o
 * pedido ainda estiver no estado esperado. É o que impede efeito duplicado
 * quando duas chamadas correm juntas — o webhook do cartão chega mais de uma vez
 * (checkout.session.completed + payment_intent.succeeded, entrega "pelo menos
 * uma vez") e o cancelamento tem dois caminhos (cliente e admin). Só quem
 * efetivamente mudou o status recebe `true` e executa os efeitos colaterais.
 *
 * Compartilhado por fulfillOrder e cancelOrder de propósito: é a única defesa
 * contra a corrida, e ter duas cópias fazia a correção poder divergir numa delas.
 */
async function claimOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: Prisma.OrderWhereInput["status"],
  to: OrderStatus
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: { status: to },
  });
  return claimed.count === 1;
}

// Invalida o cache das listas de produto (tag "products"). Best-effort: a
// transação de estoque/dinheiro já está commitada, então uma falha de
// revalidação (ex.: chamada fora do contexto de request/render — job, script)
// não deve propagar e "derrubar" uma operação que já teve sucesso no banco.
function revalidateProductsSafe() {
  try {
    revalidateTag("products", "max");
  } catch {
    // sem contexto de cache (fora do Next runtime) — ignora.
  }
}

/** Matriz como unidade de fallback (pedidos legados sem pharmacyId). */
async function fallbackPharmacyId(): Promise<string | null> {
  const m = await prisma.pharmacy.findFirst({
    where: { type: "MATRIZ", archivedAt: null },
    select: { id: true },
  });
  return m?.id ?? null;
}

export function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `FV${stamp}${rand}`;
}

export type CreateInput = {
  userId: string;
  addressId: string | null;
  customer: {
    name: string;
    email: string;
    cpf?: string | null;
    phone?: string | null;
  };
  shippingAddress: {
    recipient: string;
    zip: string;
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
  };
  pharmacyId: string | null;
  paymentMethod: string;
  deliveryMethod?: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode: string | null;
  checkoutKey?: string | null;
  notes?: string | null;
  items: { productId: string; name: string; price: number; qty: number }[];
};

function createOrderData(input: CreateInput): Prisma.OrderUncheckedCreateInput {
  const decimal = (value: number) => {
    const cents = moneyToCents(value);
    if (cents === null) throw new Error("Pedido inválido: valor monetário inválido.");
    return centsToDecimal(cents);
  };
  return {
    number: generateOrderNumber(),
    userId: input.userId,
    addressId: input.addressId,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    customerCpf: input.customer.cpf ?? null,
    customerPhone: input.customer.phone ?? null,
    shippingRecipient: input.shippingAddress.recipient,
    shippingZip: input.shippingAddress.zip,
    shippingStreet: input.shippingAddress.street,
    shippingNumber: input.shippingAddress.number,
    shippingComplement: input.shippingAddress.complement ?? null,
    shippingDistrict: input.shippingAddress.district,
    shippingCity: input.shippingAddress.city,
    shippingState: input.shippingAddress.state,
    pharmacyId: input.pharmacyId,
    status: "PENDING",
    paymentMethod: input.paymentMethod,
    deliveryMethod: input.deliveryMethod ?? "standard",
    subtotal: decimal(input.subtotal),
    shipping: decimal(input.shipping),
    discount: decimal(input.discount),
    total: decimal(input.total),
    couponCode: input.couponCode,
    checkoutKey: input.checkoutKey ?? null,
    notes: input.notes ?? null,
    items: {
      create: input.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: decimal(i.price),
        qty: i.qty,
      })),
    },
    payment: {
      create: {
        provider: input.paymentMethod === "cash" ? "CASH" : "STRIPE",
        status: "PENDING",
        amount: decimal(input.total),
      },
    },
  };
}

export async function createOrder(input: CreateInput) {
  const validationError = validateOrderFinancials(input);
  if (validationError) {
    throw new Error(`Pedido inválido: ${validationError}`);
  }

  return prisma.order.create({ data: createOrderData(input), include: { items: true } });
}

export class CheckoutReservationError extends Error {}

export type CheckoutReservations = {
  checkoutKey: string;
  loyaltyAccountId: string | null;
  redeemPoints: number;
  couponUsageLimit: number | null;
};

/**
 * Reserva cupom/pontos e cria o pedido na MESMA transação. Se o INSERT falhar,
 * as reservas voltam automaticamente. A chave única torna o POST idempotente.
 */
export async function createCheckoutOrder(
  input: CreateInput,
  reservations: CheckoutReservations
) {
  const validationError = validateOrderFinancials(input);
  if (validationError) {
    throw new Error(`Pedido inválido: ${validationError}`);
  }
  if (!reservations.checkoutKey) {
    throw new Error("Tentativa de checkout inválida.");
  }
  if (!Number.isSafeInteger(reservations.redeemPoints) || reservations.redeemPoints < 0) {
    throw new Error("Quantidade de pontos inválida.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
      where: { checkoutKey: reservations.checkoutKey },
      include: { items: true },
      });
      if (existing) {
        if (existing.userId !== input.userId) {
          throw new CheckoutReservationError("Tentativa de checkout inválida.");
        }
        return { order: existing, created: false as const };
      }

      if (reservations.redeemPoints > 0) {
        if (!reservations.loyaltyAccountId) {
          throw new CheckoutReservationError("Conta de fidelidade inválida.");
        }
        const reserved = await tx.loyaltyAccount.updateMany({
          where: {
            id: reservations.loyaltyAccountId,
            userId: input.userId,
            points: { gte: reservations.redeemPoints },
          },
          data: { points: { decrement: reservations.redeemPoints } },
        });
        if (reserved.count !== 1) {
          throw new CheckoutReservationError(
            "Seu saldo de pontos mudou. Atualize a página e tente novamente."
          );
        }
      }

      if (input.couponCode) {
        const subtotalCents = moneyToCents(input.subtotal);
        if (subtotalCents === null) {
          throw new CheckoutReservationError("Subtotal inválido.");
        }
        const where: Prisma.CouponWhereInput = {
          code: input.couponCode,
          active: true,
          minTotal: { lte: centsToDecimal(subtotalCents) },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        };
        if (reservations.couponUsageLimit != null) {
          where.usedCount = { lt: reservations.couponUsageLimit };
        }
        const reserved = await tx.coupon.updateMany({
          where,
          data: { usedCount: { increment: 1 } },
        });
        if (reserved.count !== 1) {
          throw new CheckoutReservationError("Este cupom acabou de esgotar. Tente outro.");
        }
      }

      const order = await tx.order.create({
        data: createOrderData({ ...input, checkoutKey: reservations.checkoutKey }),
        include: { items: true },
      });

      if (reservations.redeemPoints > 0 && reservations.loyaltyAccountId) {
        await tx.loyaltyTransaction.create({
          data: {
            accountId: reservations.loyaltyAccountId,
            points: -reservations.redeemPoints,
            reason: `Resgate no pedido ${order.number}`,
            orderId: order.id,
          },
        });
      }
      return { order, created: true as const };
    });
  } catch (error) {
    // Duas transações podem ler "ausente" ao mesmo tempo; a constraint decide
    // a vencedora. A perdedora devolve exatamente o pedido já criado.
    if ((error as { code?: string })?.code === "P2002") {
      const existing = await prisma.order.findUnique({
        where: { checkoutKey: reservations.checkoutKey },
        include: { items: true },
      });
      if (existing?.userId === input.userId) {
        return { order: existing, created: false as const };
      }
    }
    throw error;
  }
}

type RewardableOrder = {
  id: string;
  number: string;
  userId: string;
  total: MoneyValue;
};

async function awardOrderPoints(
  tx: Prisma.TransactionClient,
  order: RewardableOrder
) {
  const totalCents = exactMoneyToCents(order.total);
  if (totalCents === null) throw new Error("Total do pedido inválido.");
  const points = Math.floor(totalCents / 100);
  if (points <= 0) return;
  const account = await tx.loyaltyAccount.upsert({
    where: { userId: order.userId },
    create: { userId: order.userId, points },
    update: { points: { increment: points } },
  });
  await tx.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      points,
      reason: `Compra ${order.number}`,
      orderId: order.id,
    },
  });
}

/**
 * Confirma um pedido: baixa estoque e, no online, aprova pagamento/fidelidade.
 * Dinheiro entra em preparo, mas pagamento e pontos aguardam a entrega.
 * Idempotente — só age se o pedido ainda estiver PENDING.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "PENDING") return order;

  // Defesa em profundidade para pedidos legados ou gravados fora do fluxo
  // normal. Sem este guard, `decrement: -2` aumentaria o estoque.
  const validationError = validateOrderFinancials(order);
  if (validationError) {
    throw new Error(`Pedido inválido: ${validationError}`);
  }

  const isCash = order.paymentMethod === "cash";
  // Unidade que atende o pedido (matriz como fallback de pedidos legados).
  const pharmacyId = order.pharmacyId ?? (await fallbackPharmacyId());

  // Um mesmo pagamento pode chegar aqui MAIS DE UMA VEZ em paralelo. A leitura
  // acima não protege (é fora da transação), e o decremento condicional em
  // `stock >= qty` continuaria valendo na segunda passada — creditando pontos e
  // baixando estoque em DOBRO. Por isso a reivindicação atômica: só quem
  // efetivamente tira o status de PENDING executa os efeitos.
  let didFulfill = false;
  await prisma.$transaction(async (tx) => {
    didFulfill = await claimOrderStatus(
      tx,
      order.id,
      "PENDING",
      isCash ? "PREPARING" : "PAID"
    );
    if (!didFulfill) return; // já confirmado por uma chamada concorrente

    for (const item of order.items) {
      if (!item.productId || !pharmacyId) continue;
      // Decremento condicional: só baixa se houver estoque suficiente na
      // unidade. Se count === 0, aborta a transação (evita estoque negativo
      // numa corrida) — a reivindicação acima também é desfeita no rollback.
      const res = await tx.inventory.updateMany({
        where: { productId: item.productId, pharmacyId, stock: { gte: item.qty } },
        data: { stock: { decrement: item.qty } },
      });
      if (res.count === 0) {
        throw new Error(`Estoque insuficiente para "${item.name}"`);
      }
    }

    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: { status: isCash ? "PENDING" : "APPROVED" },
    });

    // Online: o webhook comprova que o dinheiro entrou. Dinheiro na entrega só
    // gera pontos quando a entrega confirma o recebimento, em markOrderDelivered.
    if (!isCash) {
      await awardOrderPoints(tx, order);
    }
  });

  // Perdeu a corrida: outra chamada já confirmou este pedido. Nada de estoque,
  // pontos ou alerta — só devolve o estado atual.
  if (!didFulfill) {
    return prisma.order.findUnique({ where: { id: order.id } });
  }

  // Estoque mudou — invalida o cache das listas de produto da home.
  // (revalidateTag com "max" funciona tanto em server actions quanto no webhook.)
  revalidateProductsSafe();

  // Alerta de reposição: avisa a equipe da unidade só quando um item CRUZA o
  // mínimo agora (antes acima, agora <= minStock) — evita spam a cada pedido.
  // Best-effort: nunca afeta a confirmação do pedido (já commitada).
  if (pharmacyId) {
    try {
      const ids = order.items
        .map((i) => i.productId)
        .filter((x): x is string => !!x);
      if (ids.length > 0) {
        const invs = await prisma.inventory.findMany({
          where: { pharmacyId, productId: { in: ids } },
          select: {
            productId: true,
            stock: true,
            minStock: true,
            product: { select: { name: true } },
          },
        });
        const qtyById = new Map(order.items.map((i) => [i.productId, i.qty]));
        const crossed = invs.filter((iv) => {
          const before = iv.stock + (qtyById.get(iv.productId) ?? 0);
          return before > iv.minStock && iv.stock <= iv.minStock;
        });
        if (crossed.length > 0) {
          const { notifyUnit } = await import("@/lib/notifications");
          const { lowStockAlertEmail } = await import("@/lib/email-templates");
          const { baseUrl } = await import("@/lib/mail");
          await notifyUnit(
            pharmacyId,
            lowStockAlertEmail(
              crossed.map((c) => ({
                name: c.product.name,
                stock: c.stock,
                minStock: c.minStock,
              })),
              `${baseUrl()}/admin/estoque`
            )
          );
        }
      }
    } catch (err) {
      reportError(err, { operation: "order.low_stock_alert" });
    }
  }

  return prisma.order.findUnique({ where: { id: order.id } });
}

/** Transição operacional sem efeitos financeiros especiais. */
export async function transitionOrderStatus(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  extra: Prisma.OrderUncheckedUpdateManyInput = {}
): Promise<boolean> {
  if (!isValidOrderTransition(from, to)) return false;
  const changed = await prisma.order.updateMany({
    where: { id: orderId, status: from },
    data: {
      ...extra,
      status: to,
      ...(to === "SHIPPED" ? { dispatchedAt: new Date() } : {}),
    },
  });
  return changed.count === 1;
}

/**
 * Conclui a entrega de forma atômica. No dinheiro, este é o primeiro momento
 * em que o recebimento foi comprovado; aprova o pagamento e credita pontos aqui.
 */
export async function markOrderDelivered(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "SHIPPED") return false;

  let delivered = false;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "SHIPPED" },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    delivered = changed.count === 1;
    if (!delivered || order.paymentMethod !== "cash") return;

    const payment = await tx.payment.updateMany({
      where: { orderId: order.id, provider: "CASH", status: "PENDING" },
      data: { status: "APPROVED", failureReason: null, failedAt: null },
    });
    if (payment.count !== 1) {
      throw new Error("O pagamento em dinheiro não está pendente.");
    }
    await awardOrderPoints(tx, order);
  });
  return delivered;
}

const CANCELABLE_STATUSES: readonly OrderStatus[] = ["PENDING", "PAID", "PREPARING"];
const REFUND_IN_PROGRESS: readonly PaymentStatus[] = [
  "APPROVED",
  "REFUND_PENDING",
  "REFUND_FAILED",
];

export async function processOrderRefund(orderId: string) {
  let payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: { select: { number: true } } },
  });
  if (!payment || !REFUND_IN_PROGRESS.includes(payment.status)) return payment;

  // Pedido sem valor não movimentou dinheiro no provedor.
  if ((exactMoneyToCents(payment.amount) ?? 0) <= 0) {
    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundError: null,
        refundRequestedAt: payment.refundRequestedAt ?? new Date(),
        refundedAt: new Date(),
      },
    });
  }
  if (payment.provider !== "STRIPE") return payment;

  if (payment.status === "APPROVED" || payment.status === "REFUND_FAILED") {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: {
        status: "REFUND_PENDING",
        refundRequestedAt: new Date(),
        refundError: null,
      },
    });
    if (claimed.count !== 1) {
      payment = await prisma.payment.findUnique({
        where: { orderId },
        include: { order: { select: { number: true } } },
      });
      if (!payment || !REFUND_IN_PROGRESS.includes(payment.status)) return payment;
    } else {
      payment = { ...payment, status: "REFUND_PENDING" };
    }
  }

  if (!payment.externalId) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "REFUND_PENDING" },
      data: {
        status: "REFUND_FAILED",
        refundError: "PaymentIntent ausente; requer reconciliação manual.",
      },
    });
    return prisma.payment.findUnique({ where: { id: payment.id } });
  }

  const { refundPayment } = await import("@/lib/stripe");
  const result = await refundPayment(payment.externalId, payment.order.number);
  if (!result.ok) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "REFUND_PENDING" },
      data: {
        status: "REFUND_FAILED",
        refundId: result.refundId,
        refundError: result.error.slice(0, 2000),
      },
    });
    return prisma.payment.findUnique({ where: { id: payment.id } });
  }
  await prisma.payment.updateMany({
    where: { id: payment.id, status: "REFUND_PENDING" },
    data: {
      refundId: result.refundId,
      refundError: null,
      status: result.status === "succeeded" ? "REFUNDED" : "REFUND_PENDING",
      refundedAt: result.status === "succeeded" ? new Date() : null,
    },
  });
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

export type CancelOrderOptions = {
  paymentFailureReason?: string;
  /** O webhook já representa o efeito no Stripe; não chama a API novamente. */
  skipProviderAction?: boolean;
};

/**
 * Cancela somente PENDING/PAID/PREPARING e reverte estoque, fidelidade e cupom
 * uma única vez. Pagamento aprovado vira REFUND_PENDING antes da chamada externa.
 */
export async function cancelOrder(
  orderId: string,
  options: CancelOrderOptions = {}
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, loyaltyTx: true },
  });
  if (!order) return null;
  if (order.status === "CANCELED") {
    if (
      !options.skipProviderAction &&
      order.payment &&
      ["REFUND_PENDING", "REFUND_FAILED"].includes(order.payment.status)
    ) {
      await processOrderRefund(order.id);
    }
    return prisma.order.findUnique({ where: { id: order.id }, include: { payment: true } });
  }
  if (!CANCELABLE_STATUSES.includes(order.status)) {
    throw new Error(`Pedido em ${order.status} não pode ser cancelado.`);
  }

  const wasFulfilled = order.status === "PAID" || order.status === "PREPARING";
  const net = order.loyaltyTx.reduce((sum, tx) => sum + tx.points, 0);
  const paymentWasApproved = order.payment?.status === "APPROVED";
  const needsProviderRefund =
    paymentWasApproved &&
    order.payment?.provider === "STRIPE" &&
    (exactMoneyToCents(order.payment.amount) ?? 0) > 0;
  const pharmacyId = order.pharmacyId ?? (await fallbackPharmacyId());

  let didCancel = false;
  await prisma.$transaction(async (tx) => {
    didCancel = await claimOrderStatus(tx, order.id, order.status, "CANCELED");
    if (!didCancel) return;

    if (wasFulfilled) {
      assertValidInventoryItems(order.items);
      for (const item of order.items) {
        if (!item.productId || !pharmacyId) continue;
        await tx.inventory.updateMany({
          where: { productId: item.productId, pharmacyId },
          data: { stock: { increment: item.qty } },
        });
      }
    }

    if (net !== 0) {
      const account = await tx.loyaltyAccount.upsert({
        where: { userId: order.userId },
        create: { userId: order.userId, points: 0 },
        update: {},
      });
      const newPoints = Math.max(0, account.points - net);
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newPoints },
      });
      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          points: -net,
          reason: `Estorno do pedido ${order.number}`,
          orderId: order.id,
        },
      });
    }

    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { code: order.couponCode, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: needsProviderRefund
          ? {
              status: "REFUND_PENDING",
              refundRequestedAt: new Date(),
              refundError: null,
            }
          : paymentWasApproved
            ? { status: "REFUNDED", refundedAt: new Date(), refundError: null }
            : {
                status: "REJECTED",
                failureReason:
                  options.paymentFailureReason?.slice(0, 2000) || "Pedido cancelado.",
                failedAt: new Date(),
              },
      });
    }
  });

  if (!didCancel) {
    return prisma.order.findUnique({ where: { id: order.id }, include: { payment: true } });
  }

  if (!options.skipProviderAction && needsProviderRefund) {
    await processOrderRefund(order.id);
  } else if (
    !options.skipProviderAction &&
    !paymentWasApproved &&
    order.payment?.provider === "STRIPE"
  ) {
    const { cancelPendingStripePayment, readCheckoutRaw } = await import("@/lib/stripe");
    const checkout = readCheckoutRaw(order.payment.raw);
    await cancelPendingStripePayment({
      paymentIntentId: order.payment.externalId,
      checkoutSessionId: checkout?.sessionId,
    });
  }

  revalidateProductsSafe();
  return prisma.order.findUnique({ where: { id: order.id }, include: { payment: true } });
}

/** Confirma o pagamento; se o pedido já foi cancelado, estorna automaticamente. */
export async function confirmStripePayment(orderId: string, paymentIntentId: string) {
  await prisma.payment.updateMany({
    where: { orderId, provider: "STRIPE" },
    data: { externalId: paymentIntentId, failureReason: null, failedAt: null },
  });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  if (order.status === "CANCELED") {
    await prisma.payment.updateMany({
      where: {
        orderId,
        status: { in: ["PENDING", "REJECTED", "APPROVED"] },
      },
      data: { status: "REFUND_PENDING", refundRequestedAt: new Date() },
    });
    await processOrderRefund(orderId);
    return prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  }
  if (order.status === "PENDING") return fulfillOrder(orderId);

  await prisma.payment.updateMany({
    where: { orderId, status: { in: ["PENDING", "REJECTED"] } },
    data: { status: "APPROVED" },
  });
  return prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
}

/** Rejeita e cancela apenas se o pedido ainda aguarda este pagamento. */
export async function failStripePayment(
  orderId: string,
  paymentIntentId: string | null,
  reason: string
) {
  if (paymentIntentId) {
    await prisma.payment.updateMany({
      where: { orderId, provider: "STRIPE" },
      data: { externalId: paymentIntentId },
    });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING") return order;
  return cancelOrder(orderId, {
    paymentFailureReason: reason,
    skipProviderAction: true,
  });
}

export type StripeRefundUpdate = {
  refundId: string;
  paymentIntentId: string | null;
  status: string | null;
  amountCents: number;
  error?: string | null;
};

/** Reconcilia eventos refund.* inclusive quando o estorno nasceu no Dashboard. */
export async function recordStripeRefund(update: StripeRefundUpdate) {
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "STRIPE",
      OR: [
        { refundId: update.refundId },
        ...(update.paymentIntentId ? [{ externalId: update.paymentIntentId }] : []),
      ],
    },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!payment) return null;

  const fullRefund = update.amountCents === exactMoneyToCents(payment.amount);
  if (
    update.status === "succeeded" &&
    fullRefund &&
    payment.order.status !== "CANCELED" &&
    CANCELABLE_STATUSES.includes(payment.order.status)
  ) {
    await cancelOrder(payment.order.id, { skipProviderAction: true });
  }

  const failed = update.status === "failed" || update.status === "canceled";
  const succeeded = update.status === "succeeded" && fullRefund;
  const nextStatus: PaymentStatus = succeeded
    ? "REFUNDED"
    : failed || (update.status === "succeeded" && !fullRefund)
      ? "REFUND_FAILED"
      : "REFUND_PENDING";
  await prisma.payment.updateMany({
    where: {
      id: payment.id,
      // Evento "created/pending" atrasado nunca rebaixa um reembolso concluído.
      status: succeeded
        ? {
            in: [
              "PENDING",
              "APPROVED",
              "REJECTED",
              "REFUND_PENDING",
              "REFUND_FAILED",
              "REFUNDED",
            ],
          }
        : { not: "REFUNDED" },
    },
    data: {
      refundId: update.refundId,
      status: nextStatus,
      refundError: succeeded
        ? null
        : !fullRefund
          ? "Reembolso parcial requer reconciliação manual."
          : update.error?.slice(0, 2000) || null,
      refundRequestedAt: payment.refundRequestedAt ?? new Date(),
      refundedAt: succeeded ? new Date() : null,
    },
  });
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

/**
 * Transfere um pedido para outra unidade, movendo o estoque corretamente:
 *  - PENDING: o estoque nunca foi baixado → só troca a unidade.
 *  - Já "fulfilled" (PAID/PREPARING/...): baixa do destino (decremento
 *    condicional anti-corrida) e devolve à origem. Se faltar estoque no destino,
 *    a transação inteira é abortada (lança Error) e a unidade NÃO muda.
 * Registra uma nota de auditoria. Retorna o pedido atualizado.
 */
export async function transferOrder(orderId: string, targetPharmacyId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, pharmacy: { select: { name: true } } },
  });
  if (!order) throw new Error("Pedido não encontrado.");

  const sourcePharmacyId = order.pharmacyId;
  if (sourcePharmacyId === targetPharmacyId) {
    throw new Error("O pedido já está nesta unidade.");
  }

  const target = await prisma.pharmacy.findFirst({
    where: { id: targetPharmacyId, active: true, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!target) throw new Error("Unidade de destino inválida.");

  // Só pedidos que saíram de PENDING tiveram baixa de estoque (via fulfillOrder).
  const wasFulfilled = order.status !== "PENDING" && order.status !== "CANCELED";

  if (wasFulfilled) {
    assertValidInventoryItems(order.items);
  }

  const stamp = new Date().toLocaleString("pt-BR");
  const auditNote = `Transferido de ${order.pharmacy?.name ?? "—"} para ${target.name} em ${stamp}.`;
  const mergedNotes = (order.notes ? `${order.notes}\n${auditNote}` : auditNote).slice(0, 2000);

  await prisma.$transaction(async (tx) => {
    if (wasFulfilled) {
      for (const item of order.items) {
        if (!item.productId) continue;
        // Baixa condicional no destino primeiro: se faltar, aborta a transação.
        const taken = await tx.inventory.updateMany({
          where: { productId: item.productId, pharmacyId: target.id, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (taken.count === 0) {
          throw new Error(`Estoque insuficiente em ${target.name} para "${item.name}".`);
        }
        // Devolve o estoque à unidade de origem.
        if (sourcePharmacyId) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, pharmacyId: sourcePharmacyId },
            data: { stock: { increment: item.qty } },
          });
        }
      }
    }
    await tx.order.update({
      where: { id: order.id },
      data: { pharmacyId: target.id, notes: mergedNotes },
    });
  });

  // Estoque mudou — invalida o cache das listas de produto.
  revalidateProductsSafe();
  return prisma.order.findUnique({ where: { id: order.id } });
}
