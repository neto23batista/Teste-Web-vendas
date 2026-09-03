import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";

export const CHARGE_LOST_RACE =
  "Esta tentativa de pagamento foi encerrada antes de ser confirmada. Refaça o pedido para gerar uma nova cobrança.";

/**
 * Vincula a cobrança recém-criada no provedor ao pedido — mas SÓ se ele ainda
 * estiver aguardando pagamento.
 *
 * Entre criar o pedido e o provedor devolver o Pix/sessão passa-se tempo de
 * rede, e nesse intervalo o pedido pode ser cancelado (pelo cliente, pelo admin
 * ou por `failStripePayment`). Uma gravação incondicional carimbava o
 * `externalId` e o QR por cima de um pagamento já rejeitado, e o cliente ainda
 * era mandado para um pedido cancelado com um Pix pagável na tela.
 *
 * O `FOR UPDATE` na linha do pedido é o que fecha a corrida: `cancelOrder`
 * reivindica essa mesma linha dentro da transação dele, então uma das duas
 * espera a outra — nunca as duas passam.
 */
export async function attachPaymentToPendingOrder(
  orderId: string,
  data: Prisma.PaymentUncheckedUpdateManyInput,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: OrderStatus }[]>`
      SELECT "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
    `;
    if (locked[0]?.status !== "PENDING") return false;
    const changed = await tx.payment.updateMany({ where: { orderId }, data });
    return changed.count === 1;
  });
}

/**
 * A cobrança existe no provedor mas não tem mais pedido para pertencer. Cancela
 * o objeto imediatamente para que ninguém pague um pedido encerrado; se a
 * chamada falhar, o incidente é reportado e a reconciliação acha o órfão depois.
 */
export async function abandonUnattachedCharge(
  target: { paymentIntentId?: string | null; checkoutSessionId?: string | null },
  operation: string,
): Promise<void> {
  try {
    const { cancelPendingStripePayment } = await import("@/lib/payments/stripe");
    await cancelPendingStripePayment(target);
  } catch (error) {
    reportError(error, { operation });
  }
}
