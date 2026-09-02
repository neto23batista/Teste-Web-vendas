import type { DeliveryProofMethod, Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";
import {
  moneyToCents as exactMoneyToCents,
  type MoneyValue,
} from "@/lib/money";
import { changeInventory } from "@/lib/inventory/movements";
import { commitOrderInventoryReservations } from "@/lib/inventory/reservations";
import {
  validateOrderFinancials,
  isValidOrderTransition,
} from "@/lib/orders/policy";
import {
  fallbackPharmacyId,
  claimOrderStatus,
  revalidateProductsSafe,
} from "@/lib/orders/shared";

type RewardableOrder = {
  id: string;
  number: string;
  userId: string;
  total: MoneyValue;
};

async function awardOrderPoints(
  tx: Prisma.TransactionClient,
  order: RewardableOrder,
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
      isCash ? "PREPARING" : "PAID",
    );
    if (!didFulfill) return; // já confirmado por uma chamada concorrente

    const reservationCount = await tx.inventoryReservation.count({
      where: { orderId: order.id, status: { in: ["ACTIVE", "COMMITTED"] } },
    });
    if (reservationCount > 0) {
      await commitOrderInventoryReservations(tx, order.id);
    } else {
      // Compatibilidade com pedidos criados antes da migração de reservas.
      for (const item of order.items) {
        if (!item.productId || !pharmacyId) continue;
        await changeInventory(tx, {
          productId: item.productId,
          pharmacyId,
          delta: -item.qty,
          kind: "SALE",
          reason: `Baixa do pedido legado ${order.number}`,
          referenceType: "ORDER",
          referenceId: order.id,
        });
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
          const { notifyUnit } =
            await import("@/lib/communications/notifications");
          const { lowStockAlertEmail } =
            await import("@/lib/communications/email-templates");
          const { baseUrl } = await import("@/lib/communications/mail");
          await notifyUnit(
            pharmacyId,
            lowStockAlertEmail(
              crossed.map((c) => ({
                name: c.product.name,
                stock: c.stock,
                minStock: c.minStock,
              })),
              `${baseUrl()}/admin/estoque`,
            ),
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
  extra: Prisma.OrderUncheckedUpdateManyInput = {},
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
export type DeliveryProofInput = {
  method: DeliveryProofMethod;
  recipientName: string;
  recipientDocumentLast4?: string | null;
  notes?: string | null;
  courierName?: string | null;
  confirmedById?: string | null;
  confirmedByEmail?: string | null;
};

export async function markOrderDelivered(
  orderId: string,
  proof?: DeliveryProofInput,
): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "SHIPPED") return false;

  let delivered = false;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "SHIPPED" },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    delivered = changed.count === 1;
    if (!delivered) return;
    if (proof) {
      await tx.deliveryProof.create({
        data: {
          orderId: order.id,
          method: proof.method,
          recipientName: proof.recipientName,
          recipientDocumentLast4: proof.recipientDocumentLast4 ?? null,
          notes: proof.notes ?? null,
          courierName: proof.courierName ?? null,
          confirmedById: proof.confirmedById ?? null,
          confirmedByEmail: proof.confirmedByEmail ?? null,
        },
      });
    }
    if (order.paymentMethod !== "cash") return;

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
