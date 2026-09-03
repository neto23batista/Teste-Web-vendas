"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, type ReturnReason } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy, requireUser } from "@/lib/auth/session";
import { centsToDecimal, moneyToCents, parseMoneyInputToCents } from "@/lib/money";
import {
  ReturnDispositionError,
  findOriginLots,
  planRestock,
  restockToOriginLots,
} from "@/lib/returns/quarantine";
import { logAuditInTransaction } from "@/lib/audit";
import { settleReturnRefund } from "@/lib/payments/return-refunds";
import { reportError } from "@/lib/monitoring";

export type ReturnActionResult = { ok: boolean; error?: string; warning?: string };

const identifier = z.string().trim().min(1).max(191);
const quantity = z.number().int().min(0).max(2_147_483_647);
const notesSchema = z.string().trim().max(1000).optional();
const requestSchema = z.object({
  orderId: identifier,
  reason: z.enum(["WITHDRAWAL", "DAMAGED", "WRONG_ITEM", "QUALITY", "OTHER"]),
  notes: notesSchema,
  items: z.array(z.object({ orderItemId: identifier, qty: quantity })).min(1).max(100),
});
const decisionSchema = z.object({
  returnId: identifier,
  approve: z.boolean(),
  approvedAmount: z.string().trim().max(32).optional(),
  adminNotes: notesSchema,
});
const receiptSchema = z.object({
  returnId: identifier,
  /** Quanto chegou fisicamente por item. Não decide nada sobre revenda. */
  received: z.array(z.object({ returnItemId: identifier, qty: quantity })).max(100),
  adminNotes: notesSchema,
});
const dispositionSchema = z.object({
  returnItemId: identifier,
  decision: z.enum(["RESTOCK", "DISCARD"]),
  qty: quantity,
  notes: notesSchema,
});

class ReturnActionError extends Error {}

function refreshReturnViews(orderId?: string) {
  revalidatePath("/conta/pedidos");
  revalidatePath("/admin/pedidos");
  if (orderId) revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function requestReturn(input: {
  orderId: string;
  reason: ReturnReason;
  notes?: string;
  items: { orderItemId: string; qty: number }[];
}): Promise<ReturnActionResult> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os itens, o motivo e as quantidades inteiras da devolução." };
  input = parsed.data;
  const notes = input.notes || null;
  const requested = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.orderItemId)) {
      return { ok: false, error: "Informe cada item da devolução apenas uma vez." };
    }
    seen.add(item.orderItemId);
    if (item.qty > 0) requested.set(item.orderItemId, item.qty);
  }
  if (requested.size === 0) {
    return { ok: false, error: "Selecione ao menos um item para devolver." };
  }

  try {
    const result = await prisma.$transaction<ReturnActionResult>(async (tx) => {
      // Serializa novas solicitações do mesmo pedido antes de calcular o
      // saldo. A unicidade parcial de devoluções ativas não basta quando uma
      // solicitação termina entre a leitura do saldo e a criação da próxima.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order"
        WHERE "id" = ${input.orderId} AND "userId" = ${user.id}
          AND "archivedAt" IS NULL
        FOR UPDATE
      `;
      if (locked.length !== 1) return { ok: false, error: "Pedido não encontrado." };
      const order = await tx.order.findFirst({
        where: { id: input.orderId, userId: user.id, archivedAt: null },
        select: {
          id: true,
          status: true,
          pharmacyId: true,
          deliveredAt: true,
          items: { select: { id: true, qty: true, price: true } },
        },
      });
      if (!order) return { ok: false, error: "Pedido não encontrado." };
      if (order.status !== "DELIVERED" || !order.deliveredAt) {
        return { ok: false, error: "A devolução fica disponível após a entrega." };
      }
      if (!order.pharmacyId) {
        return { ok: false, error: "Pedido sem unidade responsável; fale com o atendimento." };
      }
      const orderItemIds = new Set(order.items.map((item) => item.id));
      if (input.items.some((item) => !orderItemIds.has(item.orderItemId))) {
        return { ok: false, error: "Um dos itens não pertence a este pedido." };
      }
      const deadline = new Date(order.deliveredAt.getTime() + 7 * 86_400_000);
      if (deadline < new Date()) {
        return { ok: false, error: "O prazo operacional de solicitação deste pedido terminou." };
      }

      const prior = await tx.returnItem.groupBy({
        by: ["orderItemId"],
        where: {
          orderItemId: { in: [...requested.keys()] },
          returnRequest: {
            orderId: order.id,
            status: { notIn: ["REJECTED", "CANCELED"] },
          },
        },
        _sum: { qty: true },
      });
      const priorByItem = new Map(prior.map((item) => [item.orderItemId, item._sum.qty ?? 0]));
      let requestedCents = 0;
      const createItems: { orderItemId: string; qty: number }[] = [];
      for (const orderItem of order.items) {
        const qty = requested.get(orderItem.id);
        if (!qty) continue;
        const available = orderItem.qty - (priorByItem.get(orderItem.id) ?? 0);
        if (qty > available) {
          return { ok: false, error: "A quantidade solicitada ultrapassa o saldo devolvível." };
        }
        const unitCents = moneyToCents(orderItem.price);
        if (unitCents === null) throw new Error("Preço histórico inválido no pedido.");
        requestedCents += unitCents * qty;
        createItems.push({ orderItemId: orderItem.id, qty });
      }
      if (createItems.length !== requested.size || !Number.isSafeInteger(requestedCents)) {
        return { ok: false, error: "Um dos itens não pertence a este pedido." };
      }

      await tx.returnRequest.create({
        data: {
          orderId: order.id,
          userId: user.id,
          pharmacyId: order.pharmacyId,
          reason: input.reason,
          customerNotes: notes,
          requestedAmount: centsToDecimal(requestedCents),
          items: { create: createItems },
        },
      });
      return { ok: true };
    });
    if (result.ok) refreshReturnViews(input.orderId);
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Já existe uma devolução em andamento para este pedido." };
    }
    reportError(error, { operation: "return.request" });
    return { ok: false, error: "Não foi possível registrar a solicitação." };
  }
}

export async function cancelReturnRequest(returnId: string): Promise<ReturnActionResult> {
  const user = await requireUser();
  const request = await prisma.returnRequest.findFirst({
    where: { id: returnId, userId: user.id },
    select: { id: true, orderId: true, status: true },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  const changed = await prisma.returnRequest.updateMany({
    where: { id: request.id, userId: user.id, status: "REQUESTED" },
    data: { status: "CANCELED", completedAt: new Date() },
  });
  if (changed.count !== 1) return { ok: false, error: "Esta solicitação não pode mais ser cancelada." };
  refreshReturnViews(request.orderId);
  return { ok: true };
}

export async function decideReturnRequest(input: {
  returnId: string;
  approve: boolean;
  approvedAmount?: string;
  adminNotes?: string;
}): Promise<ReturnActionResult> {
  await assertArea("pedidos");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os dados da análise da devolução." };
  input = parsed.data;
  const request = await prisma.returnRequest.findUnique({
    where: { id: input.returnId },
    select: { id: true, orderId: true, pharmacyId: true, requestedAmount: true, status: true },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  const actor = await requireAdminAtPharmacy(request.pharmacyId);
  if (request.status !== "REQUESTED") {
    return { ok: false, error: "A solicitação já foi analisada." };
  }
  const requestedCents = moneyToCents(request.requestedAmount);
  if (requestedCents === null) return { ok: false, error: "Valor histórico inválido na solicitação." };
  const approvedCents = input.approve
    ? input.approvedAmount?.trim()
      ? parseMoneyInputToCents(input.approvedAmount)
      : requestedCents
    : null;
  if (input.approve && (approvedCents === null || approvedCents < 0 || approvedCents > requestedCents)) {
    return { ok: false, error: "Valor aprovado inválido." };
  }
  const notes = input.adminNotes?.trim().slice(0, 1000) || null;

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.returnRequest.updateMany({
        where: { id: request.id, status: "REQUESTED" },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          approvedAmount: approvedCents == null ? null : centsToDecimal(approvedCents),
          adminNotes: notes,
          decidedAt: new Date(),
          ...(!input.approve ? { completedAt: new Date() } : {}),
        },
      });
      if (changed.count !== 1) throw new ReturnActionError("A solicitação já foi analisada.");
      await logAuditInTransaction(tx, {
        action: input.approve ? "return.approve" : "return.reject",
        entity: "ReturnRequest",
        entityId: request.id,
        pharmacyId: request.pharmacyId,
        detail: input.approve ? `Aprovou devolução em ${centsToDecimal(approvedCents!)}` : "Rejeitou devolução",
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    if (!(error instanceof ReturnActionError)) reportError(error, { operation: "return.decide" });
    return { ok: false, error: error instanceof ReturnActionError ? error.message : "Não foi possível analisar a devolução." };
  }
  refreshReturnViews(request.orderId);
  return { ok: true };
}

export async function receiveReturnRequest(input: {
  returnId: string;
  received: { returnItemId: string; qty: number }[];
  adminNotes?: string;
}): Promise<ReturnActionResult> {
  await assertArea("pedidos");
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os itens e informe quantidades inteiras recebidas." };
  input = parsed.data;
  const request = await prisma.returnRequest.findUnique({
    where: { id: input.returnId },
    include: {
      items: {
        include: { orderItem: { select: { productId: true, name: true } } },
      },
    },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  const actor = await requireAdminAtPharmacy(request.pharmacyId);
  if (request.status !== "APPROVED") {
    return { ok: false, error: "A devolução precisa estar aprovada para ser recebida." };
  }
  const returnItemIds = new Set(request.items.map((item) => item.id));
  const receivedByItem = new Map<string, number>();
  for (const item of input.received) {
    if (!returnItemIds.has(item.returnItemId)) {
      return { ok: false, error: "Um dos itens informados não pertence a esta devolução." };
    }
    if (receivedByItem.has(item.returnItemId)) {
      return { ok: false, error: "Informe cada item apenas uma vez." };
    }
    receivedByItem.set(item.returnItemId, item.qty);
  }
  for (const item of request.items) {
    const qty = receivedByItem.get(item.id) ?? 0;
    if (!Number.isSafeInteger(qty) || qty < 0 || qty > item.qty) {
      return { ok: false, error: `Quantidade recebida inválida para ${item.orderItem.name}.` };
    }
  }
  const notes = input.adminNotes?.trim().slice(0, 1000) || request.adminNotes;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.returnRequest.updateMany({
        where: { id: request.id, status: "APPROVED" },
        data: { status: "RECEIVED", receivedAt: new Date(), adminNotes: notes },
      });
      if (claimed.count !== 1) throw new ReturnActionError("A devolução já foi recebida.");
      for (const item of request.items) {
        const receivedQty = receivedByItem.get(item.id) ?? 0;
        // O recebimento NÃO mexe no estoque. Medicamento que voltou da casa do
        // cliente fica em quarentena até a conferência sanitária decidir — antes
        // ele virava saldo vendável na hora, sem lote e sem validade.
        await tx.returnItem.update({
          where: { id: item.id },
          data: {
            receivedQty,
            disposition: receivedQty > 0 ? "PENDING" : "DISCARDED",
            ...(receivedQty === 0
              ? {
                  decidedAt: new Date(),
                  dispositionNotes: "Não chegou na conferência de recebimento.",
                }
              : {}),
          },
        });
      }
      await logAuditInTransaction(tx, {
        action: "return.receive",
        entity: "ReturnRequest",
        entityId: request.id,
        pharmacyId: request.pharmacyId,
        detail:
          "Recebeu fisicamente a devolução; itens em quarentena aguardando conferência",
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    if (!(error instanceof ReturnActionError)) reportError(error, { operation: "return.receive" });
    return { ok: false, error: error instanceof ReturnActionError ? error.message : "Falha ao receber devolução." };
  }
  refreshReturnViews(request.orderId);
  revalidatePath("/admin/estoque");
  revalidateTag("products", "max");
  try {
    const settlement = await settleReturnRefund(request.id);
    return {
      ok: true,
      ...(settlement.pending
        ? { warning: "Itens recebidos; o reembolso está sendo processado pelo Stripe." }
        : !settlement.ok
          ? { warning: settlement.error ?? "Itens recebidos, mas a liquidação precisa ser refeita." }
          : {}),
    };
  } catch (error) {
    // O recebimento e o estoque já foram commitados. Não sinalizar que a
    // operação física falhou nem induzir o operador a repetir essa reposição.
    reportError(error, { operation: "return.receive.settlement" });
    return { ok: true, warning: "Itens recebidos; a liquidação está indisponível e precisa ser retomada pelo painel." };
  }
}

/**
 * Conferência sanitária de um item em quarentena.
 *
 * Liberar devolve as unidades ao LOTE de origem — o mesmo que a venda consumiu,
 * rastreado pela alocação da reserva. Sem lote rastreável, ou com o lote
 * vencido, a liberação é recusada: as saídas são descartar ou registrar um lote
 * novo em Compras, com a validade conferida na embalagem.
 */
export async function decideReturnItemDisposition(input: {
  returnItemId: string;
  decision: "RESTOCK" | "DISCARD";
  qty: number;
  notes?: string;
}): Promise<ReturnActionResult> {
  await assertArea("estoque");
  const parsed = dispositionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confira a decisão e informe uma quantidade inteira." };
  }
  input = parsed.data;

  const item = await prisma.returnItem.findUnique({
    where: { id: input.returnItemId },
    include: {
      orderItem: { select: { id: true, productId: true, name: true } },
      returnRequest: {
        select: { id: true, orderId: true, pharmacyId: true, status: true },
      },
    },
  });
  if (!item) return { ok: false, error: "Item de devolução não encontrado." };
  const actor = await requireAdminAtPharmacy(item.returnRequest.pharmacyId);
  if (item.disposition !== "PENDING") {
    return { ok: false, error: "Este item já passou pela conferência." };
  }
  if (!["RECEIVED", "COMPLETED"].includes(item.returnRequest.status)) {
    return { ok: false, error: "A devolução precisa ter sido recebida." };
  }
  if (input.qty > item.receivedQty) {
    return { ok: false, error: "A quantidade informada é maior do que a recebida." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Reivindicação atômica: dois conferentes na mesma tela não decidem duas
      // vezes o mesmo item — o que devolveria o dobro ao lote.
      const claimed = await tx.returnItem.updateMany({
        where: { id: item.id, disposition: "PENDING" },
        data: {
          disposition: input.decision === "RESTOCK" ? "RESTOCKED" : "DISCARDED",
          restockQty: input.decision === "RESTOCK" ? input.qty : 0,
          decidedAt: new Date(),
          decidedById: actor.id ?? null,
          decidedByEmail: actor.email ?? null,
          dispositionNotes: input.notes || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ReturnActionError("Este item já passou pela conferência.");
      }

      let detail = `Descartou ${input.qty} un de "${item.orderItem.name}" devolvido`;
      if (input.decision === "RESTOCK") {
        if (!item.orderItem.productId) {
          throw new ReturnDispositionError(
            `"${item.orderItem.name}" não possui mais cadastro; não é possível repor.`,
          );
        }
        const lots = await findOriginLots(tx, item.orderItem.id);
        const plan = planRestock(lots, input.qty);
        await restockToOriginLots(tx, {
          productId: item.orderItem.productId,
          pharmacyId: item.returnRequest.pharmacyId,
          plan,
          reason: `Devolução liberada do pedido ${item.returnRequest.orderId}: ${item.orderItem.name}`,
          referenceId: item.returnRequest.id,
          actor,
        });
        await tx.returnItem.update({
          where: { id: item.id },
          data: { restockLotId: plan[0]!.lotId },
        });
        detail = `Liberou ${input.qty} un de "${item.orderItem.name}" de volta ao lote ${plan
          .map((entry) => entry.lotCode)
          .join(", ")}`;
      }

      await logAuditInTransaction(tx, {
        action:
          input.decision === "RESTOCK"
            ? "return.item.restock"
            : "return.item.discard",
        entity: "ReturnItem",
        entityId: item.id,
        pharmacyId: item.returnRequest.pharmacyId,
        detail,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    const expected =
      error instanceof ReturnActionError || error instanceof ReturnDispositionError;
    if (!expected) reportError(error, { operation: "return.disposition" });
    return {
      ok: false,
      error: expected ? error.message : "Não foi possível registrar a conferência.",
    };
  }

  refreshReturnViews(item.returnRequest.orderId);
  revalidatePath("/admin/estoque");
  revalidateTag("products", "max");
  return { ok: true };
}

export async function retryReturnRefund(returnId: string): Promise<ReturnActionResult> {
  await assertArea("pedidos");
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    select: { id: true, orderId: true, pharmacyId: true },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  await requireAdminAtPharmacy(request.pharmacyId);
  const result = await settleReturnRefund(request.id);
  refreshReturnViews(request.orderId);
  return result.ok
    ? {
        ok: true,
        ...(result.pending ? { warning: "Reembolso ainda em processamento no Stripe." } : {}),
      }
    : { ok: false, error: result.error ?? "Não foi possível liquidar a devolução." };
}
