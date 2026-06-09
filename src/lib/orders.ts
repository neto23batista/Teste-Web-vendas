import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

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

export function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `FV${stamp}${rand}`;
}

type CreateInput = {
  userId: string;
  addressId: string | null;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode: string | null;
  requiresPrescription: boolean;
  items: { productId: string; name: string; price: number; qty: number }[];
};

export async function createOrder(input: CreateInput) {
  return prisma.order.create({
    data: {
      number: generateOrderNumber(),
      userId: input.userId,
      addressId: input.addressId,
      status: "PENDING",
      requiresPrescription: input.requiresPrescription,
      paymentMethod: input.paymentMethod,
      subtotal: input.subtotal,
      shipping: input.shipping,
      discount: input.discount,
      total: input.total,
      couponCode: input.couponCode,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
      },
      payment: {
        create: {
          provider: input.paymentMethod === "cash" ? "CASH" : "MERCADO_PAGO",
          status: "PENDING",
          amount: input.total,
        },
      },
    },
    include: { items: true },
  });
}

/**
 * Confirma um pedido: baixa estoque, aprova pagamento e credita fidelidade.
 * Idempotente — só age se o pedido ainda estiver PENDING.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "PENDING") return order;

  const isCash = order.paymentMethod === "cash";
  // Pedidos com receita ficam RETIDOS em PAID após o pagamento, aguardando
  // validação farmacêutica — não avançam para PREPARING automaticamente.
  const isRx = order.requiresPrescription;
  const points = Math.floor(order.total);

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.productId) {
        // Decremento condicional: só baixa se houver estoque suficiente.
        // Se count === 0, aborta a transação (evita estoque negativo numa corrida).
        const res = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (res.count === 0) {
          throw new Error(`Estoque insuficiente para "${item.name}"`);
        }
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: isCash && !isRx ? "PREPARING" : "PAID" },
    });

    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: { status: isCash ? "PENDING" : "APPROVED" },
    });

    if (points > 0) {
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
  });

  // Estoque mudou — invalida o cache das listas de produto da home.
  // (revalidateTag com "max" funciona tanto em server actions quanto no webhook.)
  revalidateProductsSafe();

  return prisma.order.findUnique({ where: { id: order.id } });
}

/**
 * Cancela um pedido e reverte todos os efeitos colaterais de forma transacional
 * e idempotente:
 *  - Estoque: devolve a quantidade dos itens (só se o pedido já tinha sido
 *    "fulfilled" — em PENDING o estoque nunca foi baixado).
 *  - Fidelidade: estorna o saldo líquido movido pelo pedido (ganho + resgate),
 *    restaurando o saldo anterior à compra.
 *  - Cupom: libera 1 uso (decrementa usedCount).
 *  - Status: pedido → CANCELED; pagamento aprovado → REFUNDED.
 * O reembolso no provedor (Mercado Pago) é best-effort e fica FORA da transação.
 * Retorna o pedido atualizado, ou null se o id não existir.
 */
export async function cancelOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, loyaltyTx: true },
  });
  if (!order) return null;
  if (order.status === "CANCELED") return order; // idempotência

  // Só pedidos que saíram de PENDING tiveram baixa de estoque (via fulfillOrder).
  const wasFulfilled = order.status !== "PENDING";
  // Saldo líquido movido pelo pedido: ganho (+) e resgate (-) somados.
  // Estornar -net devolve o resgate e remove o ganho, voltando ao saldo pré-compra.
  const net = order.loyaltyTx.reduce((sum, tx) => sum + tx.points, 0);
  const paymentWasApproved = order.payment?.status === "APPROVED";

  // Dois caminhos podem cancelar (botão do cliente e dropdown do admin). Para
  // evitar reversão dupla numa corrida, "reivindicamos" o cancelamento de forma
  // atômica: só quem efetivamente vira o status para CANCELED executa a reversão.
  let didCancel = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: { not: "CANCELED" } },
      data: { status: "CANCELED" },
    });
    if (claimed.count === 0) return; // já cancelado por uma chamada concorrente
    didCancel = true;

    if (wasFulfilled) {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          });
        }
      }
    }

    if (net !== 0) {
      // A conta de fidelidade já existe se houve qualquer movimento; usa upsert
      // por segurança. Nunca deixa o saldo negativo.
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

    if (paymentWasApproved) {
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: "REFUNDED" },
      });
    }
  });

  // Reembolso no Mercado Pago (best-effort, fora da transação): só quem reivindicou
  // o cancelamento e tinha pagamento online aprovado tenta estornar. A chave de
  // idempotência no provedor também protege contra reembolso duplicado.
  if (
    didCancel &&
    paymentWasApproved &&
    order.payment?.provider === "MERCADO_PAGO" &&
    order.payment.externalId
  ) {
    const { refundPayment } = await import("@/lib/mercadopago");
    await refundPayment(order.payment.externalId);
  }

  // Estoque/pontos mudaram — invalida o cache das listas de produto.
  revalidateProductsSafe();

  return prisma.order.findUnique({ where: { id: order.id } });
}
