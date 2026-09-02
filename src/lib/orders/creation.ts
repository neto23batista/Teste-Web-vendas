import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { centsToDecimal } from "@/lib/money";
import { reserveOrderInventory } from "@/lib/inventory/reservations";
import { moneyToCents, validateOrderFinancials } from "@/lib/orders/policy";

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
    if (cents === null)
      throw new Error("Pedido inválido: valor monetário inválido.");
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

  return prisma.order.create({
    data: createOrderData(input),
    include: { items: true },
  });
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
  reservations: CheckoutReservations,
) {
  const validationError = validateOrderFinancials(input);
  if (validationError) {
    throw new Error(`Pedido inválido: ${validationError}`);
  }
  if (!reservations.checkoutKey) {
    throw new Error("Tentativa de checkout inválida.");
  }
  if (
    !Number.isSafeInteger(reservations.redeemPoints) ||
    reservations.redeemPoints < 0
  ) {
    throw new Error("Quantidade de pontos inválida.");
  }
  if (!input.pharmacyId) {
    throw new CheckoutReservationError(
      "Não foi possível definir a unidade responsável.",
    );
  }
  const checkoutPharmacyId = input.pharmacyId;

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
            "Seu saldo de pontos mudou. Atualize a página e tente novamente.",
          );
        }
      }

      let reservedCouponId: string | null = null;
      if (input.couponCode) {
        const subtotalCents = moneyToCents(input.subtotal);
        if (subtotalCents === null) {
          throw new CheckoutReservationError("Subtotal inválido.");
        }
        const coupon = await tx.coupon.findUnique({
          where: { code: input.couponCode },
          select: {
            id: true,
            active: true,
            minTotal: true,
            expiresAt: true,
            usageLimit: true,
            usedCount: true,
            usageLimitPerCustomer: true,
          },
        });
        const minTotalCents = coupon ? moneyToCents(coupon.minTotal) : null;
        if (
          !coupon ||
          !coupon.active ||
          minTotalCents === null ||
          subtotalCents < minTotalCents ||
          (coupon.expiresAt && coupon.expiresAt <= new Date())
        ) {
          throw new CheckoutReservationError(
            "Este cupom não está mais disponível.",
          );
        }
        // Serializa somente os usos deste cliente/cupom. Assim duas abas não
        // ultrapassam o limite individual antes que o INSERT fique visível.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`coupon:${coupon.id}:${input.userId}`}, 0))`;
        const customerUses = await tx.couponRedemption.count({
          where: { couponId: coupon.id, userId: input.userId },
        });
        if (customerUses >= coupon.usageLimitPerCustomer) {
          throw new CheckoutReservationError(
            "Você já atingiu o limite de uso deste cupom.",
          );
        }
        const reserved = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            ...(coupon.usageLimit != null
              ? { usedCount: { lt: coupon.usageLimit } }
              : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (reserved.count !== 1) {
          throw new CheckoutReservationError(
            "Este cupom acabou de esgotar. Tente outro.",
          );
        }
        reservedCouponId = coupon.id;
      }

      const order = await tx.order.create({
        data: createOrderData({
          ...input,
          checkoutKey: reservations.checkoutKey,
        }),
        include: { items: true },
      });

      // O estoque disponível é comprometido na mesma transação do pedido. Se
      // qualquer item faltar, pedido, cupom e pontos voltam juntos.
      await reserveOrderInventory(tx, {
        orderId: order.id,
        orderNumber: order.number,
        pharmacyId: checkoutPharmacyId,
        items: order.items,
      });

      if (reservedCouponId) {
        await tx.couponRedemption.create({
          data: {
            couponId: reservedCouponId,
            userId: input.userId,
            orderId: order.id,
          },
        });
      }

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
