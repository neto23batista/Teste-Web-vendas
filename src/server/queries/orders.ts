import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth/session";
import { moneyToNumber } from "@/lib/money";
import { readCheckoutRaw, readPixRaw } from "@/lib/payments/stripe";
import { qrPngBase64 } from "@/lib/qrcode";

function isExpired(value: string | null) {
  if (!value) return false;
  const expiresAt = Date.parse(value);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

/** Só a titularidade do request pode acessar o pagamento e o endereço do pedido. */
export async function getCustomerOrderView(number: string) {
  const user = await requireUserPage(`/pedido/${number}`);
  const row = await prisma.order.findUnique({
    where: { number },
    select: {
      id: true, userId: true, number: true, status: true, createdAt: true,
      subtotal: true, discount: true, shipping: true, total: true, couponCode: true,
      paymentMethod: true, deliveryMethod: true, notes: true, dispatchedAt: true,
      shippingRecipient: true, shippingStreet: true, shippingNumber: true,
      shippingComplement: true, shippingDistrict: true, shippingCity: true,
      shippingState: true, shippingZip: true,
      items: { select: {
        id: true, name: true, price: true, qty: true,
        product: { select: { slug: true, emoji: true } },
      } },
      payment: { select: { status: true, raw: true } },
      courier: { select: { name: true } },
    },
  });
  if (!row) return null;
  if (row.userId !== user.id) {
    if (user.role === "ADMIN") redirect(`/admin/pedidos/${row.id}`);
    return null;
  }

  const isCanceled = row.status === "CANCELED";
  const isPaid = row.status !== "PENDING" && !isCanceled;
  const awaitingPayment = row.status === "PENDING" && row.paymentMethod !== "cash"
    && (!row.payment || row.payment.status === "PENDING");
  const pixData = readPixRaw(row.payment?.raw);
  const pixExpired = isExpired(pixData?.expiresAt ?? null);
  const pix = awaitingPayment && row.paymentMethod === "pix" && !pixExpired ? pixData : null;
  const checkout = readCheckoutRaw(row.payment?.raw);
  const cardCheckoutAvailable = awaitingPayment && row.paymentMethod === "card"
    && Boolean(checkout?.url) && !isExpired(checkout?.expiresAt ?? null);
  const pixQrBase64 = pix ? pix.qrCodeBase64 || await qrPngBase64(pix.qrCode) : "";
  const order = {
    id: row.id, number: row.number, status: row.status, createdAt: row.createdAt,
    subtotal: moneyToNumber(row.subtotal), discount: moneyToNumber(row.discount),
    shipping: moneyToNumber(row.shipping), total: moneyToNumber(row.total),
    couponCode: row.couponCode, paymentMethod: row.paymentMethod,
    deliveryMethod: row.deliveryMethod, notes: row.notes, dispatchedAt: row.dispatchedAt,
    shippingRecipient: row.shippingRecipient, shippingStreet: row.shippingStreet,
    shippingNumber: row.shippingNumber, shippingComplement: row.shippingComplement,
    shippingDistrict: row.shippingDistrict, shippingCity: row.shippingCity,
    shippingState: row.shippingState, shippingZip: row.shippingZip,
    items: row.items.map((item) => ({ ...item, price: moneyToNumber(item.price) })),
    payment: row.payment ? { status: row.payment.status } : null,
    courier: row.courier,
  };
  return {
    order, isCanceled, isPaid, awaitingPayment, pixExpired, pix, pixQrBase64,
    cardCheckoutAvailable,
    cardCheckout: cardCheckoutAvailable ? { url: checkout!.url! } : null,
    canCancel: ["PENDING", "PAID", "PREPARING"].includes(row.status),
    live: !pix && ((row.status !== "DELIVERED" && row.status !== "CANCELED")
      || row.payment?.status === "REFUND_PENDING" || row.payment?.status === "REFUND_FAILED"),
  };
}
