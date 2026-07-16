"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { shippingFor, type DeliveryMethod } from "@/lib/shipping";
import { getShippingConfig, getPaymentSettings, resolveKm } from "@/lib/settings";
import { validateCoupon } from "@/lib/coupons";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/loyalty";
import { createOrder, fulfillOrder, cancelOrder } from "@/lib/orders";
import { createHostedCheckout, createPixPayment } from "@/lib/stripe";
import {
  defaultPaymentMethod,
  isPaymentMethodAvailable,
  paymentAvailability,
} from "@/lib/payment-methods";
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
  if (!(await rateLimit(`checkout:${ip}:${user.id}`, 10, 60_000)).ok) {
    return { error: "Muitas tentativas em sequência. Aguarde um instante." };
  }

  const cart = await getCart();
  if (!cart || cart.items.length === 0) return { error: "Sua sacola está vazia." };
  if (!cart.pharmacyId) {
    return { error: "Nenhuma unidade disponível para atender o pedido." };
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

  // O formulário já só exibe o que dá para cobrar, mas o método vem do CLIENTE:
  // aceitar "pix" com o Pix desabilitado criaria o pedido e jogaria o cliente numa
  // página sem QR e sem cobrança — pedido preso, sem como pagar. Valida aqui.
  const payment = await getPaymentSettings();
  const availability = paymentAvailability(payment);
  const requested =
    str(formData, "paymentMethod") || defaultPaymentMethod(availability);
  if (!isPaymentMethodAvailable(requested, availability)) {
    return {
      error:
        requested === "pix"
          ? "Pix indisponível no momento. Escolha cartão ou dinheiro na entrega."
          : "Forma de pagamento indisponível. Escolha outra opção.",
    };
  }
  const paymentMethod = requested;

  // O PIX exige o CPF do pagador. Usa o do cadastro; se não houver, exige o
  // informado no checkout (11 dígitos) e salva no cadastro p/ as próximas compras.
  let payerCpf: string | null = null;
  if (paymentMethod === "pix") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cpf: true },
    });
    if (dbUser?.cpf) {
      payerCpf = dbUser.cpf;
    } else {
      const informed = str(formData, "cpf").replace(/\D/g, "");
      if (informed.length !== 11) {
        return { error: "Para pagar com PIX, informe um CPF válido (11 dígitos)." };
      }
      payerCpf = informed;
      await prisma.user.update({ where: { id: user.id }, data: { cpf: informed } });
    }
  }

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

  // Frete pelo CEP do endereço escolhido (fonte da verdade no servidor):
  // resolve a distância (km) pela faixa de CEP da unidade e aplica a modalidade.
  const deliveryMethod: DeliveryMethod =
    str(formData, "deliveryMethod") === "express" ? "express" : "standard";
  const shipAddr = addressId
    ? await prisma.address.findUnique({
        where: { id: addressId },
        select: { zip: true },
      })
    : null;
  const [shippingConfig, km] = await Promise.all([
    getShippingConfig(cart.pharmacyId),
    resolveKm(shipAddr?.zip, cart.pharmacyId),
  ]);
  const shipping = shippingFor(subtotal, km, deliveryMethod, shippingConfig);
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
    deliveryMethod,
    subtotal,
    shipping,
    discount,
    total,
    couponCode,
    notes: str(formData, "notes").slice(0, 500) || null,
    items: cart.items.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      price: i.product.promoPrice ?? i.product.price,
      qty: i.qty,
    })),
  });

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

  // Capturados aqui de propósito: dentro de uma função aninhada o TS não mantém
  // o narrow feito pelos guards lá em cima (`cart` não-nulo e `pharmacyId` != null).
  const cartId = cart.id;
  const cartPharmacyId = cart.pharmacyId;

  // Efeitos que só valem quando o pedido REALMENTE segue: esvaziar a sacola e
  // avisar cliente/unidade. Antes rodavam aqui, ANTES do pagamento — então uma
  // falha ao gerar o Pix/cartão cancelava o pedido mas deixava a sacola vazia
  // (o cliente não conseguia refazer) e ainda mandava e-mail de um pedido que
  // seria cancelado. Agora só rodam nos caminhos de sucesso, via este helper.
  async function finalizeSuccess() {
    await prisma.cartItem.deleteMany({ where: { cartId } });
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
      cartPharmacyId,
      newOrderForUnitEmail(
        { number: order.number, total: order.total, itemsCount: order.items.length },
        `${baseUrl()}/admin/pedidos/${order.id}`
      )
    );
  }

  // Pagamento
  // Total zerado (100% desconto/pontos): nada a cobrar — confirma direto.
  if (total <= 0) {
    try {
      await fulfillOrder(order.id);
    } catch {
      // Corrida rara de estoque: pedido fica PENDENTE para tratativa manual.
    }
    await finalizeSuccess();
    redirect(`/pedido/${order.number}`);
  }
  if (paymentMethod === "cash") {
    try {
      await fulfillOrder(order.id);
    } catch {
      // Corrida rara de estoque: pedido permanece PENDENTE para tratativa manual.
    }
    await finalizeSuccess();
    redirect(`/pedido/${order.number}`);
  }
  if (availability.stripeConfigured) {
    // PIX nativo: gera o QR/copia-e-cola e mostra na própria página do pedido
    // (sem sair do site). O webhook confirma a aprovação.
    if (paymentMethod === "pix") {
      // CPF do pagador já resolvido/validado acima (obrigatório para PIX).
      const pix = await createPixPayment({
        orderNumber: order.number,
        amount: order.total,
        payerEmail: user.email ?? "",
        payerName: user.name,
        payerTaxId: payerCpf,
        description: `FarmaVida ${order.number}`,
      });
      // Sem QR não há como pagar. Antes o pedido era criado assim mesmo e o cliente
      // caía numa página vazia, com o pedido preso em "aguardando pagamento" para
      // sempre. Desfaz o pedido (devolve cupom/pontos) e explica o que fazer.
      if (!pix) {
        await cancelOrder(order.id).catch((e) =>
          console.error("[checkout] falha ao cancelar pedido órfão (pix):", e)
        );
        return {
          error:
            "Não foi possível gerar o Pix agora. Escolha cartão ou dinheiro na entrega.",
        };
      }
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
      await finalizeSuccess();
      redirect(`/pedido/${order.number}`);
    }
    // Cartão (e demais): Checkout Session hospedada do Stripe. O total do pedido
    // (já com cupom/pontos) é o valor cobrado — sem ele o cliente pagaria o preço
    // cheio e o webhook recusaria o pagamento por divergência.
    const url = await createHostedCheckout({
      orderNumber: order.number,
      items: order.items.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
      shipping,
      total: order.total,
      customerEmail: user.email,
      customerName: user.name,
    });
    if (url) {
      await finalizeSuccess();
      redirect(url);
    }
    // Mesma lógica do PIX: sem página de pagamento, não há como cobrar.
    await cancelOrder(order.id).catch((e) =>
      console.error("[checkout] falha ao cancelar pedido órfão (cartão):", e)
    );
    return {
      error:
        "Não foi possível iniciar o pagamento no cartão. Tente novamente ou escolha dinheiro na entrega.",
    };
  }
  // Inalcançável na prática: sem Stripe configurado, o único método que passa na
  // validação é "cash", que já saiu acima. Fica como rede de segurança.
  await finalizeSuccess();
  redirect(`/pedido/${order.number}`);
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
  // Atalho de demonstração — desabilitado em produção (pagamento real via PagBank/webhook).
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
