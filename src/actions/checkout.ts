"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { shippingFor } from "@/lib/shipping";
import { getShippingConfig } from "@/lib/settings";
import { validateCoupon } from "@/lib/coupons";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/loyalty";
import { saveUpload } from "@/lib/uploads";
import { createOrder, fulfillOrder, cancelOrder } from "@/lib/orders";
import { createPreference, createPixPayment, mpConfigured } from "@/lib/mercadopago";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, baseUrl } from "@/lib/mail";
import { notifyUnit } from "@/lib/notifications";
import { orderReceivedEmail, newOrderForUnitEmail } from "@/lib/email-templates";

export type CheckoutState = { error?: string } | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function placeOrder(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const user = await requireUser();

  // Limita a frequência de checkout por usuário (anti-abuso / duplo clique).
  const ip = await clientIp();
  if (!rateLimit(`checkout:${ip}:${user.id}`, 10, 60_000).ok) {
    return { error: "Muitas tentativas em sequência. Aguarde um instante." };
  }

  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { error: "Sua sacola está vazia." };
  if (!cart.pharmacyId) {
    return { error: "Nenhuma unidade disponível para atender o pedido." };
  }

  // Valida a receita ANTES de criar o pedido (evita pedido órfão se o
  // arquivo for inválido/grande).
  const presFile = formData.get("prescription");
  let prescriptionKey: string | null = null;
  if (presFile instanceof File && presFile.size > 0) {
    const up = await saveUpload(presFile, "prescriptions");
    if (!up.ok) return { error: up.error };
    prescriptionKey = up.key;
  }

  // Itens com tarja exigem receita anexada (validação farmacêutica obrigatória).
  if (cart.requiresPrescription && !prescriptionKey) {
    return {
      error: "Envie a receita médica dos itens que exigem prescrição para continuar.",
    };
  }

  // Re-valida estoque DA UNIDADE no momento do checkout (pode ter mudado desde
  // a sacola). Produto inativo não retorna na query → tratado como insuficiente.
  const stocks = await prisma.inventory.findMany({
    where: {
      pharmacyId: cart.pharmacyId,
      productId: { in: cart.items.map((i) => i.product.id) },
      product: { active: true },
    },
    select: { productId: true, stock: true },
  });
  const stockById = new Map(stocks.map((s) => [s.productId, s.stock]));
  const insufficient = cart.items.filter(
    (i) => (stockById.get(i.product.id) ?? 0) < i.qty
  );
  if (insufficient.length > 0) {
    const names = insufficient.map((i) => i.product.name).join(", ");
    return {
      error: `Estoque insuficiente para: ${names}. Ajuste sua sacola e tente novamente.`,
    };
  }

  const paymentMethod = str(formData, "paymentMethod") || "pix";

  // Endereço: existente ou novo
  let addressId: string | null = str(formData, "addressId") || null;
  if (addressId) {
    const owns = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    });
    if (!owns) addressId = null;
  }
  if (!addressId) {
    const recipient = str(formData, "recipient");
    const zip = str(formData, "zip");
    const street = str(formData, "street");
    const number = str(formData, "number");
    const district = str(formData, "district");
    const city = str(formData, "city");
    const state = str(formData, "state");
    if (!recipient || !zip || !street || !number || !district || !city || !state) {
      return { error: "Preencha todos os campos do endereço de entrega." };
    }
    const created = await prisma.address.create({
      data: {
        userId: user.id,
        label: str(formData, "label") || "Entrega",
        recipient,
        zip,
        street,
        number,
        complement: str(formData, "complement") || null,
        district,
        city,
        state,
        isDefault: false,
      },
    });
    addressId = created.id;
  }

  // Totais
  const subtotal = cart.subtotal;
  let discount = 0;
  let couponCode: string | null = null;
  let couponUsageLimit: number | null = null;
  const couponRaw = str(formData, "coupon");
  if (couponRaw) {
    const res = await validateCoupon(couponRaw, subtotal);
    if ("error" in res) return { error: res.error };
    discount = res.discount;
    couponCode = res.code;
    couponUsageLimit = res.usageLimit;
  }

  // Resgate de pontos de fidelidade: re-valida o saldo e o teto no servidor
  // (a base é o subtotal já com o cupom aplicado).
  let redeemPoints = Math.max(0, Math.floor(Number(str(formData, "redeemPoints")) || 0));
  let redeemDiscount = 0;
  let loyaltyAccountId: string | null = null;
  if (redeemPoints > 0) {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId: user.id },
      select: { id: true, points: true },
    });
    const allowed = maxRedeemablePoints(
      account?.points ?? 0,
      Math.max(0, subtotal - discount)
    );
    redeemPoints = Math.min(redeemPoints, allowed);
    if (redeemPoints > 0 && account) {
      loyaltyAccountId = account.id;
      redeemDiscount = pointsToBRL(redeemPoints);
      discount += redeemDiscount;
    } else {
      redeemPoints = 0;
    }
  }

  // Frete pelo CEP do endereço escolhido (fonte da verdade no servidor).
  const shipAddr = addressId
    ? await prisma.address.findUnique({
        where: { id: addressId },
        select: { zip: true },
      })
    : null;
  const shipping = shippingFor(subtotal, shipAddr?.zip, await getShippingConfig(cart.pharmacyId));
  const total = Math.max(0, subtotal - discount) + shipping;

  // Reserva atômica dos pontos (antes do cupom): decrementa só se o saldo
  // ainda comporta o resgate. Em corrida, aborta sem ter tocado no cupom.
  if (redeemPoints > 0 && loyaltyAccountId) {
    const reserved = await prisma.loyaltyAccount.updateMany({
      where: { id: loyaltyAccountId, points: { gte: redeemPoints } },
      data: { points: { decrement: redeemPoints } },
    });
    if (reserved.count === 0) {
      return {
        error: "Seu saldo de pontos mudou. Atualize a página e tente novamente.",
      };
    }
  }

  // Reserva atômica do cupom (antes de criar o pedido): evita corrida que
  // ultrapasse o usageLimit. O incremento só "pega" se ainda houver saldo.
  if (couponCode) {
    const where: Prisma.CouponWhereInput = {
      code: couponCode,
      active: true,
    };
    if (couponUsageLimit != null) where.usedCount = { lt: couponUsageLimit };
    const reserved = await prisma.coupon.updateMany({
      where,
      data: { usedCount: { increment: 1 } },
    });
    if (reserved.count === 0) {
      // Devolve os pontos já reservados antes de abortar.
      if (redeemPoints > 0 && loyaltyAccountId) {
        await prisma.loyaltyAccount.update({
          where: { id: loyaltyAccountId },
          data: { points: { increment: redeemPoints } },
        });
      }
      return { error: "Este cupom acabou de esgotar. Tente outro." };
    }
  }

  // Pedido
  const order = await createOrder({
    userId: user.id,
    addressId,
    pharmacyId: cart.pharmacyId,
    paymentMethod,
    subtotal,
    shipping,
    discount,
    total,
    couponCode,
    requiresPrescription: cart.requiresPrescription,
    notes: str(formData, "notes").slice(0, 500) || null,
    items: cart.items.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      price: i.product.promoPrice ?? i.product.price,
      qty: i.qty,
    })),
  });

  // Receita (já validada e salva acima — só associa ao pedido)
  if (prescriptionKey) {
    await prisma.prescription.create({
      data: { userId: user.id, orderId: order.id, fileUrl: prescriptionKey },
    });
  }

  // Registra o resgate de pontos no extrato (saldo já debitado acima).
  if (redeemPoints > 0 && loyaltyAccountId) {
    await prisma.loyaltyTransaction.create({
      data: {
        accountId: loyaltyAccountId,
        points: -redeemPoints,
        reason: `Resgate no pedido ${order.number}`,
        orderId: order.id,
      },
    });
  }

  // Limpa a sacola
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidatePath("/sacola");
  revalidatePath("/conta");

  // Confirmação "pedido recebido" (best-effort — não bloqueia o checkout).
  if (user.email) {
    const mail = orderReceivedEmail(
      { number: order.number, total: order.total },
      `${baseUrl()}/pedido/${order.number}`
    );
    await sendMail({ to: user.email, subject: mail.subject, html: mail.html });
  }

  // Avisa a equipe da unidade que atende o pedido (best-effort).
  await notifyUnit(
    cart.pharmacyId,
    newOrderForUnitEmail(
      { number: order.number, total: order.total, itemsCount: order.items.length },
      `${baseUrl()}/admin/pedidos/${order.id}`
    )
  );

  // Pagamento
  // Total zerado (100% desconto/pontos): nada a cobrar — confirma direto.
  if (total <= 0) {
    try {
      await fulfillOrder(order.id);
    } catch {
      // Corrida rara de estoque: pedido fica PENDENTE para tratativa manual.
    }
    redirect(`/pedido/${order.number}`);
  }
  if (paymentMethod === "cash") {
    try {
      await fulfillOrder(order.id);
    } catch {
      // Corrida rara de estoque: pedido permanece PENDENTE para tratativa manual.
    }
    redirect(`/pedido/${order.number}`);
  }
  if (mpConfigured()) {
    // PIX nativo: gera o QR/copia-e-cola e mostra na própria página do pedido
    // (sem sair do site). O webhook confirma a aprovação.
    if (paymentMethod === "pix") {
      const pix = await createPixPayment({
        orderNumber: order.number,
        amount: order.total,
        payerEmail: user.email ?? "",
        payerName: user.name,
        description: `FarmaVida ${order.number}`,
      });
      if (pix) {
        await prisma.payment.updateMany({
          where: { orderId: order.id },
          data: {
            externalId: pix.paymentId,
            raw: {
              pix: {
                qrCode: pix.qrCode,
                qrCodeBase64: pix.qrCodeBase64,
                ticketUrl: pix.ticketUrl,
                expiresAt: pix.expiresAt,
              },
            },
          },
        });
      }
      redirect(`/pedido/${order.number}`);
    }
    // Cartão (e demais): Checkout Pro hospedado no Mercado Pago.
    const url = await createPreference({
      orderNumber: order.number,
      items: order.items.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
      shipping,
    });
    if (url) redirect(url);
  }
  // Fallback (sem token MP): página do pedido com pagamento simulado
  redirect(`/pedido/${order.number}`);
}

export async function resubmitPrescription(
  orderNumber: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const order = await prisma.order.findUnique({
    where: { number: orderNumber },
    select: { id: true, userId: true },
  });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "Pedido não encontrado." };
  }

  const file = formData.get("prescription");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo de receita." };
  }
  const up = await saveUpload(file, "prescriptions");
  if (!up.ok) return { ok: false, error: up.error };

  await prisma.prescription.create({
    data: { userId: user.id, orderId: order.id, fileUrl: up.key },
  });
  revalidatePath(`/pedido/${orderNumber}`);
  revalidatePath("/conta/receitas");
  return { ok: true };
}

// Status em que o próprio cliente ainda pode cancelar. Depois de SHIPPED/
// DELIVERED o cancelamento passa a ser tratado pelo atendimento (admin).
const CLIENT_CANCELABLE: OrderStatus[] = ["PENDING", "PAID", "PREPARING"];

export async function cancelMyOrder(
  orderNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const order = await prisma.order.findUnique({
    where: { number: orderNumber },
    select: { id: true, userId: true, status: true },
  });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "Pedido não encontrado." };
  }
  if (order.status === "CANCELED") {
    return { ok: false, error: "Este pedido já está cancelado." };
  }
  if (!CLIENT_CANCELABLE.includes(order.status)) {
    return {
      ok: false,
      error: "Este pedido já saiu para entrega e não pode mais ser cancelado por aqui.",
    };
  }

  await cancelOrder(order.id);

  revalidatePath(`/pedido/${orderNumber}`);
  revalidatePath("/conta");
  return { ok: true };
}

export async function confirmPaymentSimulated(orderNumber: string) {
  // Atalho de demonstração — desabilitado em produção (pagamento real via MP/webhook).
  if (process.env.NODE_ENV === "production") return { ok: false };

  const user = await requireUser();
  const order = await prisma.order.findUnique({ where: { number: orderNumber } });
  if (!order || order.userId !== user.id) return { ok: false };
  try {
    await fulfillOrder(order.id);
  } catch {
    return { ok: false };
  }
  revalidatePath(`/pedido/${orderNumber}`);
  revalidatePath("/conta");
  return { ok: true };
}
