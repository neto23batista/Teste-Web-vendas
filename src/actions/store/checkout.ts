"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/catalog/policy";
import { requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/commerce/cart";
import { getPaymentSettings } from "@/lib/settings";
import { quoteCheckout } from "@/lib/commerce/checkout-quote";
import {
  createCheckoutOrder,
  fulfillOrder,
  cancelOrder,
  CheckoutReservationError,
  isValidItemQuantity,
  isValidStock,
  validateOrderFinancials,
  type CreateInput,
} from "@/lib/orders";
import { createHostedCheckout, createPixPayment } from "@/lib/payments/stripe";
import {
  CHARGE_LOST_RACE,
  abandonUnattachedCharge,
  attachPaymentToPendingOrder,
} from "@/lib/payments/charge-binding";
import { InventoryExpiredStockError } from "@/lib/inventory/lots";
import { InsufficientInventoryError } from "@/lib/inventory/movements";
import {
  defaultPaymentMethod,
  isPaymentMethodAvailable,
  paymentAvailability,
} from "@/lib/payments/methods";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { sendMail, baseUrl } from "@/lib/communications/mail";
import { notifyUnit } from "@/lib/communications/notifications";
import { orderReceivedEmail, newOrderForUnitEmail } from "@/lib/communications/email-templates";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { reportError } from "@/lib/monitoring";
import { withWriteConflictRetry } from "@/lib/concurrency";
import { moneyToCents, moneyToNumber } from "@/lib/money";
import {
  addressFromFormData,
  validateAddress,
} from "@/lib/shipping/address";
import { createUserAddressWithinLimit } from "@/lib/shipping/address-persistence";

export type CheckoutState = { error?: string } | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export type CheckoutPreviewInput = {
  addressId?: string | null;
  zip?: string | null;
  coupon?: string | null;
  redeemPoints?: number;
  deliveryMethod?: string | null;
};

export async function previewCheckoutQuote(input: CheckoutPreviewInput) {
  const user = await requireUser();
  if (!(await rateLimit(`checkout-preview:${user.id}`, 60, 60_000)).ok) {
    return { ok: false as const, error: "Muitas atualizações. Aguarde um instante." };
  }
  const cart = await getCart();
  if (!cart?.pharmacyId || cart.items.length === 0) {
    return { ok: false as const, error: "Sua sacola está vazia." };
  }
  try {
    const quote = await quoteCheckout({
      userId: user.id,
      pharmacyId: cart.pharmacyId,
      subtotal: cart.subtotal,
      addressId: input?.addressId?.slice(0, 128) || null,
      zip: input?.zip?.slice(0, 16) || null,
      coupon: input?.coupon?.slice(0, 50) || null,
      requestedRedeemPoints: input?.redeemPoints ?? 0,
      deliveryMethod: input?.deliveryMethod,
    });
    return {
      ok: true as const,
      quote: {
        subtotal: quote.subtotal,
        couponCode: quote.couponCode,
        couponDiscount: quote.couponDiscount,
        redeemPoints: quote.redeemPoints,
        redeemDiscount: quote.redeemDiscount,
        discount: quote.discount,
        shipping: quote.shipping,
        total: quote.total,
        deliveryMethod: quote.deliveryMethod,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Não foi possível calcular o total.",
    };
  }
}

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

  const checkoutAttempt = str(formData, "checkoutAttempt");
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(checkoutAttempt)) {
    return { error: "A tentativa de checkout expirou. Atualize a página." };
  }
  // A chave persistida não revela o token do navegador nem permite colisão
  // entre usuários/carrinhos que por acaso enviem o mesmo valor.
  const checkoutKey = createHash("sha256")
    .update(`${user.id}:${cart.id}:${checkoutAttempt}`)
    .digest("hex");

  const orderItems = cart.items.map((i) => ({
    productId: i.product.id,
    name: i.product.name,
    price: i.product.promoPrice ?? i.product.price,
    qty: i.qty,
  }));
  // Não confia nem no carrinho persistido: ele pode ser legado ou ter sido
  // gravado antes das constraints. Isso barra qty negativa/fracionária antes
  // de qualquer efeito colateral do checkout.
  if (
    cart.items.some((item) => !isValidItemQuantity(item.qty)) ||
    validateOrderFinancials({
      subtotal: cart.subtotal,
      shipping: 0,
      discount: 0,
      total: cart.subtotal,
      items: orderItems,
    })
  ) {
    return {
      error:
        "Sua sacola contém uma quantidade ou valor inválido. Remova o item e adicione novamente.",
    };
  }

  // Re-valida estoque DA UNIDADE no momento do checkout (pode ter mudado desde
  // a sacola). Produto inativo não retorna na query → tratado como insuficiente.
  const stocks = await prisma.inventory.findMany({
    where: {
      pharmacyId: cart.pharmacyId,
      productId: { in: cart.items.map((i) => i.product.id) },
      // Política de venda completa: item inativo OU sujeito a receita não volta
      // na consulta e é tratado como estoque insuficiente logo abaixo.
      product: SALEABLE_PRODUCT_WHERE,
    },
    select: { productId: true, stock: true },
  });
  if (stocks.some((item) => !isValidStock(item.stock))) {
    return {
      error: "O estoque da unidade está inconsistente. Tente novamente mais tarde.",
    };
  }
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

  // Os dados do pedido são congelados a partir do banco no checkout. A conta e
  // o endereço podem ser alterados depois sem reescrever o documento histórico.
  let checkoutCustomer = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, cpf: true, phone: true },
  });
  if (!checkoutCustomer) return { error: "Conta não encontrada." };

  // O PIX exige o CPF do pagador. Usa o do cadastro; se não houver, exige o
  // informado no checkout (11 dígitos) e salva no cadastro p/ as próximas compras.
  if (paymentMethod === "pix") {
    if (checkoutCustomer.cpf && isValidCpf(checkoutCustomer.cpf)) {
      checkoutCustomer = {
        ...checkoutCustomer,
        cpf: onlyDigits(checkoutCustomer.cpf),
      };
    } else {
      const informed = onlyDigits(str(formData, "cpf"));
      if (!isValidCpf(informed)) {
        return { error: "Para pagar com PIX, informe um CPF válido." };
      }
      try {
        await prisma.user.update({ where: { id: user.id }, data: { cpf: informed } });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return {
            error:
              "Este CPF já está vinculado a outra conta. Entre na conta correta ou fale com o suporte.",
          };
        }
        throw error;
      }
      checkoutCustomer = { ...checkoutCustomer, cpf: informed };
    }
  }

  // Endereço: existente ou novo
  let addressId: string | null = str(formData, "addressId") || null;
  let shippingAddress: CreateInput["shippingAddress"] | null = null;
  if (addressId) {
    const owns = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
      select: {
        recipient: true,
        zip: true,
        street: true,
        number: true,
        complement: true,
        district: true,
        city: true,
        state: true,
      },
    });
    if (!owns) addressId = null;
    else shippingAddress = owns;
  }
  if (!addressId) {
    const normalized = addressFromFormData(formData);
    const addressError = validateAddress(normalized);
    if (addressError) return { error: addressError };
    const addressResult = await createUserAddressWithinLimit(user.id, normalized);
    if (!addressResult.ok) {
      return {
        error: "Limite de 20 endereços atingido. Selecione um existente ou remova um antigo.",
      };
    }
    const created = addressResult.address;
    addressId = created.id;
    shippingAddress = {
      recipient: created.recipient,
      zip: created.zip,
      street: created.street,
      number: created.number,
      complement: created.complement,
      district: created.district,
      city: created.city,
      state: created.state,
    };
  }
  if (!shippingAddress) return { error: "Endereço de entrega inválido." };

  // A mesma cotação server-only abastece o preview e este INSERT. Assim cupom,
  // pontos, CEP e frete não têm implementações concorrentes.
  const couponRaw = str(formData, "coupon");
  const redeemRaw = str(formData, "redeemPoints");
  const requestedRedeemPoints = redeemRaw ? Number(redeemRaw) : 0;
  let quote: Awaited<ReturnType<typeof quoteCheckout>>;
  try {
    quote = await quoteCheckout({
      userId: user.id,
      pharmacyId: cart.pharmacyId,
      subtotal: cart.subtotal,
      addressId,
      coupon: couponRaw,
      requestedRedeemPoints,
      deliveryMethod: str(formData, "deliveryMethod"),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível calcular o total.",
    };
  }
  const {
    subtotal,
    discount,
    shipping,
    total,
    couponCode,
    couponUsageLimit,
    redeemPoints,
    loyaltyAccountId,
    deliveryMethod,
  } = quote;

  const orderInput: CreateInput = {
    userId: user.id,
    addressId,
    customer: {
      name: checkoutCustomer.name,
      email: checkoutCustomer.email,
      cpf: checkoutCustomer.cpf,
      phone: checkoutCustomer.phone,
    },
    shippingAddress,
    pharmacyId: cart.pharmacyId,
    paymentMethod,
    deliveryMethod,
    subtotal,
    shipping,
    discount,
    total,
    couponCode,
    checkoutKey,
    notes: str(formData, "notes").slice(0, 500) || null,
    items: orderItems,
  };
  const financialError = validateOrderFinancials(orderInput);
  if (financialError) {
    return {
      error:
        "Não foi possível validar os valores do pedido. Atualize a página e tente novamente.",
    };
  }

  // Pedido + reservas formam uma unidade atômica. A mesma tentativa devolve o
  // mesmo pedido; falha no INSERT não deixa cupom/pontos consumidos.
  let checkoutOrder: Awaited<ReturnType<typeof createCheckoutOrder>>;
  try {
    // Deadlock entre dois carrinhos com os mesmos itens é conflito momentâneo,
    // não erro do cliente. Repetir é seguro: a transação inteira voltou e a
    // chave de tentativa mantém a operação idempotente — uma repetição que
    // encontre o pedido já criado devolve exatamente ele.
    checkoutOrder = await withWriteConflictRetry(() =>
      createCheckoutOrder(orderInput, {
        checkoutKey,
        loyaltyAccountId,
        redeemPoints,
        couponUsageLimit,
      }),
    );
  } catch (error) {
    if (error instanceof CheckoutReservationError) {
      return { error: error.message };
    }
    // Indisponibilidade real no momento da reserva — outra compra levou o saldo,
    // ou o que resta na unidade está em lote vencido. É resultado ESPERADO, não
    // incidente: a transação já devolveu cupom e pontos, e reportar isso afogaria
    // os erros de verdade. A causa exata é da operação, não do cliente, e aparece
    // no diagnóstico de lotes por unidade — `npm run ops:lots`.
    if (
      error instanceof InventoryExpiredStockError ||
      error instanceof InsufficientInventoryError
    ) {
      return {
        error:
          "Um item da sua sacola acabou de ficar indisponível nesta unidade. Revise a sacola e tente novamente.",
      };
    }
    // Sobra aqui o que não deveria acontecer — inclusive InventoryLotBalanceError,
    // que significa saldo de lote maior que o estoque da unidade. Continua sendo
    // incidente de propósito.
    reportError(error, { operation: "checkout.order.create" });
    return {
      error: "Não foi possível criar o pedido. Nenhum cupom ou ponto foi consumido.",
    };
  }
  const { order, created: orderCreated } = checkoutOrder;
  const orderTotal = moneyToNumber(order.total);
  if (!orderCreated && order.status === "CANCELED") {
    return {
      error: "Esta tentativa já foi encerrada. Tente novamente para criar um novo pedido.",
    };
  }
  if (!orderCreated && order.status !== "PENDING") {
    redirect(`/pedido/${order.number}`);
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
    if (order.customerEmail) {
      const mail = orderReceivedEmail(
        { number: order.number, total: orderTotal },
        `${baseUrl()}/pedido/${order.number}`
      );
      await sendMail({
        to: order.customerEmail,
        subject: mail.subject,
        html: mail.html,
      });
    }

    // Avisa a equipe da unidade que atende o pedido (best-effort).
    await notifyUnit(
      cartPharmacyId,
      newOrderForUnitEmail(
        { number: order.number, total: orderTotal, itemsCount: order.items.length },
        `${baseUrl()}/admin/pedidos/${order.id}`
      )
    );
  }

  // Pagamento
  // Total zerado (100% desconto/pontos): nada a cobrar — confirma direto.
  if ((moneyToCents(order.total) ?? 0) <= 0) {
    try {
      await fulfillOrder(order.id);
    } catch (error) {
      await cancelOrder(order.id, {
        paymentFailureReason: "Falha ao reservar estoque.",
      }).catch(() => null);
      reportError(error, { operation: "checkout.zero_total.fulfill" });
      return { error: "O estoque mudou. Revise sua sacola e tente novamente." };
    }
    await finalizeSuccess();
    redirect(`/pedido/${order.number}`);
  }
  // Em uma repetição idempotente, os campos do navegador podem ter mudado
  // depois do primeiro POST. O meio/valor persistidos no pedido são a fonte da
  // verdade; nunca cobramos ou confirmamos usando a segunda versão do formulário.
  if (order.paymentMethod === "cash") {
    try {
      await fulfillOrder(order.id);
    } catch (error) {
      await cancelOrder(order.id, {
        paymentFailureReason: "Falha ao reservar estoque.",
      }).catch(() => null);
      reportError(error, { operation: "checkout.cash.fulfill" });
      return { error: "O estoque mudou. Revise sua sacola e tente novamente." };
    }
    await finalizeSuccess();
    redirect(`/pedido/${order.number}`);
  }
  if (availability.stripeConfigured) {
    // PIX nativo: gera o QR/copia-e-cola e mostra na própria página do pedido
    // (sem sair do site). O webhook confirma a aprovação.
    if (order.paymentMethod === "pix") {
      // Usa o snapshot, inclusive numa repetição idempotente cujo formulário
      // tenha sido alterado depois do primeiro POST.
      const snapshotCpf = onlyDigits(order.customerCpf ?? "");
      if (!isValidCpf(snapshotCpf)) {
        await cancelOrder(order.id, {
          paymentFailureReason: "CPF ausente no snapshot do pedido Pix.",
        }).catch(() => null);
        return { error: "O CPF do pedido Pix está inválido. Tente novamente." };
      }
      const pix = await createPixPayment({
        orderNumber: order.number,
        amount: orderTotal,
        payerEmail: order.customerEmail,
        payerName: order.customerName,
        payerTaxId: snapshotCpf,
        description: `FarmaVida ${order.number}`,
      });
      // Sem QR não há como pagar. Antes o pedido era criado assim mesmo e o cliente
      // caía numa página vazia, com o pedido preso em "aguardando pagamento" para
      // sempre. Desfaz o pedido (devolve cupom/pontos) e explica o que fazer.
      if (!pix) {
        await cancelOrder(order.id, {
          paymentFailureReason: "Não foi possível criar a cobrança Pix.",
        }).catch((error) => {
          reportError(error, { operation: "checkout.pix.compensate" });
        });
        return {
          error:
            "Não foi possível gerar o Pix agora. Escolha cartão ou dinheiro na entrega.",
        };
      }
      const pixAttached = await attachPaymentToPendingOrder(order.id, {
        externalId: pix.paymentId,
        raw: {
          pix: {
            qrCode: pix.qrCode,
            qrCodeBase64: pix.qrCodeBase64,
            ticketUrl: pix.ticketUrl,
            expiresAt: pix.expiresAt,
          },
        },
      });
      if (!pixAttached) {
        await abandonUnattachedCharge(
          { paymentIntentId: pix.paymentId },
          "checkout.pix.orphan",
        );
        return { error: CHARGE_LOST_RACE };
      }
      await finalizeSuccess();
      redirect(`/pedido/${order.number}`);
    }
    // Cartão (e demais): Checkout Session hospedada do Stripe. O total do pedido
    // (já com cupom/pontos) é o valor cobrado — sem ele o cliente pagaria o preço
    // cheio e o webhook recusaria o pagamento por divergência.
    const checkout = await createHostedCheckout({
      orderNumber: order.number,
      items: order.items.map((i) => ({
        name: i.name,
        price: moneyToNumber(i.price),
        qty: i.qty,
      })),
      shipping: moneyToNumber(order.shipping),
      total: orderTotal,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
    });
    if (checkout) {
      const sessionAttached = await attachPaymentToPendingOrder(order.id, {
        raw: {
          checkout: {
            sessionId: checkout.sessionId,
            url: checkout.url,
            expiresAt: checkout.expiresAt,
          },
        },
      });
      if (!sessionAttached) {
        await abandonUnattachedCharge(
          { checkoutSessionId: checkout.sessionId },
          "checkout.card.orphan",
        );
        return { error: CHARGE_LOST_RACE };
      }
      await finalizeSuccess();
      redirect(checkout.url);
    }
    // Mesma lógica do PIX: sem página de pagamento, não há como cobrar.
    await cancelOrder(order.id, {
      paymentFailureReason: "Não foi possível criar a sessão de cartão.",
    }).catch((error) => {
      reportError(error, { operation: "checkout.card.compensate" });
    });
    return {
      error:
        "Não foi possível iniciar o pagamento no cartão. Tente novamente ou escolha dinheiro na entrega.",
    };
  }
  // Pode acontecer numa repetição idempotente se a configuração foi removida
  // depois do primeiro POST. Não confirma nem esvazia a sacola sem cobrança.
  return {
    error:
      "O provedor de pagamento ficou indisponível. Tente novamente em instantes.",
  };
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
