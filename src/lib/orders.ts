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

/** Matriz como unidade de fallback (pedidos legados sem pharmacyId). */
async function fallbackPharmacyId(): Promise<string | null> {
  const m = await prisma.pharmacy.findFirst({
    where: { type: "MATRIZ" },
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

type CreateInput = {
  userId: string;
  addressId: string | null;
  pharmacyId: string | null;
  paymentMethod: string;
  deliveryMethod?: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode: string | null;
  requiresPrescription: boolean;
  notes?: string | null;
  items: { productId: string; name: string; price: number; qty: number }[];
};

export async function createOrder(input: CreateInput) {
  return prisma.order.create({
    data: {
      number: generateOrderNumber(),
      userId: input.userId,
      addressId: input.addressId,
      pharmacyId: input.pharmacyId,
      status: "PENDING",
      requiresPrescription: input.requiresPrescription,
      paymentMethod: input.paymentMethod,
      deliveryMethod: input.deliveryMethod ?? "standard",
      subtotal: input.subtotal,
      shipping: input.shipping,
      discount: input.discount,
      total: input.total,
      couponCode: input.couponCode,
      notes: input.notes ?? null,
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
          provider: input.paymentMethod === "cash" ? "CASH" : "PAGBANK",
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
  // Unidade que atende o pedido (matriz como fallback de pedidos legados).
  const pharmacyId = order.pharmacyId ?? (await fallbackPharmacyId());

  // Um mesmo pagamento pode chegar aqui MAIS DE UMA VEZ em paralelo: o cartão
  // dispara dois eventos no Stripe (checkout.session.completed e
  // payment_intent.succeeded) e a entrega do webhook é "pelo menos uma vez".
  // A leitura acima não protege (é fora da transação), e o decremento condicional
  // em `stock >= qty` continuaria valendo na segunda passada — creditando pontos
  // e baixando estoque em DOBRO. Por isso reivindicamos o pedido de forma atômica:
  // só quem efetivamente tira o status de PENDING executa os efeitos.
  let didFulfill = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: isCash && !isRx ? "PREPARING" : "PAID" },
    });
    if (claimed.count === 0) return; // já confirmado por uma chamada concorrente
    didFulfill = true;

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
      console.error("[fulfillOrder] alerta de baixo estoque falhou:", err);
    }
  }

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
 * O reembolso no provedor (PagBank) é best-effort e fica FORA da transação.
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
  const pharmacyId = order.pharmacyId ?? (await fallbackPharmacyId());

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
        if (!item.productId || !pharmacyId) continue;
        await tx.inventory.updateMany({
          where: { productId: item.productId, pharmacyId },
          data: { stock: { increment: item.qty } },
        });
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

  // Reembolso no PagBank (best-effort, fora da transação): só quem reivindicou
  // o cancelamento e tinha pagamento online aprovado tenta estornar. A chave de
  // idempotência no provedor também protege contra reembolso duplicado.
  if (
    didCancel &&
    paymentWasApproved &&
    order.payment?.provider !== "CASH" &&
    order.payment?.externalId
  ) {
    const { refundPayment } = await import("@/lib/stripe");
    await refundPayment(order.payment.externalId);
  }

  // Estoque/pontos mudaram — invalida o cache das listas de produto.
  revalidateProductsSafe();

  return prisma.order.findUnique({ where: { id: order.id } });
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
    where: { id: targetPharmacyId, active: true },
    select: { id: true, name: true },
  });
  if (!target) throw new Error("Unidade de destino inválida.");

  // Só pedidos que saíram de PENDING tiveram baixa de estoque (via fulfillOrder).
  const wasFulfilled = order.status !== "PENDING" && order.status !== "CANCELED";

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
