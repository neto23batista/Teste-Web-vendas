"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type ReturnReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy, requireUser } from "@/lib/session";
import { centsToDecimal, moneyToCents, parseMoneyInputToCents } from "@/lib/money";
import { changeInventory } from "@/lib/inventory-movements";
import { logAuditInTransaction } from "@/lib/audit";
import { settleReturnRefund } from "@/lib/return-refunds";

export type ReturnActionResult = { ok: boolean; error?: string; warning?: string };

const REASONS = new Set<ReturnReason>([
  "WITHDRAWAL",
  "DAMAGED",
  "WRONG_ITEM",
  "QUALITY",
  "OTHER",
]);

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
  if (!REASONS.has(input.reason)) return { ok: false, error: "Motivo inválido." };
  const notes = input.notes?.trim().slice(0, 1000) || null;
  const requested = new Map<string, number>();
  for (const item of input.items) {
    const qty = Math.trunc(Number(item.qty));
    if (!Number.isSafeInteger(qty) || qty < 0) {
      return { ok: false, error: "Quantidade de devolução inválida." };
    }
    if (qty > 0) requested.set(item.orderItemId, qty);
  }
  if (requested.size === 0) {
    return { ok: false, error: "Selecione ao menos um item para devolver." };
  }

  try {
    const order = await prisma.order.findFirst({
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
    const deadline = new Date(order.deliveredAt.getTime() + 7 * 86_400_000);
    if (deadline < new Date()) {
      return { ok: false, error: "O prazo operacional de solicitação deste pedido terminou." };
    }

    const prior = await prisma.returnItem.groupBy({
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

    await prisma.returnRequest.create({
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
    refreshReturnViews(order.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Já existe uma devolução em andamento para este pedido." };
    }
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
  const request = await prisma.returnRequest.findUnique({
    where: { id: input.returnId },
    select: { id: true, orderId: true, pharmacyId: true, requestedAmount: true, status: true },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  const actor = await requireAdminAtPharmacy(request.pharmacyId);
  if (request.status !== "REQUESTED") {
    return { ok: false, error: "A solicitação já foi analisada." };
  }
  const requestedCents = moneyToCents(request.requestedAmount)!;
  const approvedCents = input.approve
    ? input.approvedAmount?.trim()
      ? parseMoneyInputToCents(input.approvedAmount)
      : requestedCents
    : null;
  if (input.approve && (approvedCents === null || approvedCents < 0 || approvedCents > requestedCents)) {
    return { ok: false, error: "Valor aprovado inválido." };
  }
  const notes = input.adminNotes?.trim().slice(0, 1000) || null;

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
    if (changed.count !== 1) throw new Error("A solicitação já foi analisada.");
    await logAuditInTransaction(tx, {
      action: input.approve ? "return.approve" : "return.reject",
      entity: "ReturnRequest",
      entityId: request.id,
      pharmacyId: request.pharmacyId,
      detail: input.approve ? `Aprovou devolução em ${centsToDecimal(approvedCents!)}` : "Rejeitou devolução",
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });
  refreshReturnViews(request.orderId);
  return { ok: true };
}

export async function receiveReturnRequest(input: {
  returnId: string;
  restock: { returnItemId: string; qty: number }[];
  adminNotes?: string;
}): Promise<ReturnActionResult> {
  await assertArea("pedidos");
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
  const requestedRestock = new Map(input.restock.map((item) => [item.returnItemId, Math.trunc(Number(item.qty))]));
  for (const item of request.items) {
    const qty = requestedRestock.get(item.id) ?? 0;
    if (!Number.isSafeInteger(qty) || qty < 0 || qty > item.qty) {
      return { ok: false, error: `Quantidade de reposição inválida para ${item.orderItem.name}.` };
    }
    if (qty > 0 && !item.orderItem.productId) {
      return { ok: false, error: `${item.orderItem.name} não possui mais cadastro para reposição.` };
    }
  }
  const notes = input.adminNotes?.trim().slice(0, 1000) || request.adminNotes;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.returnRequest.updateMany({
        where: { id: request.id, status: "APPROVED" },
        data: { status: "RECEIVED", receivedAt: new Date(), adminNotes: notes },
      });
      if (claimed.count !== 1) throw new Error("A devolução já foi recebida.");
      for (const item of request.items) {
        const restockQty = requestedRestock.get(item.id) ?? 0;
        await tx.returnItem.update({ where: { id: item.id }, data: { restockQty } });
        if (restockQty === 0) continue;
        await changeInventory(tx, {
          productId: item.orderItem.productId!,
          pharmacyId: request.pharmacyId,
          delta: restockQty,
          kind: "RETURN",
          reason: `Retorno aprovado do pedido ${request.orderId}: ${item.orderItem.name}`,
          referenceType: "RETURN_REQUEST",
          referenceId: request.id,
          actor,
        });
      }
      await logAuditInTransaction(tx, {
        action: "return.receive",
        entity: "ReturnRequest",
        entityId: request.id,
        pharmacyId: request.pharmacyId,
        detail: "Recebeu fisicamente a devolução e repôs somente itens reaproveitáveis",
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao receber devolução." };
  }
  refreshReturnViews(request.orderId);
  revalidatePath("/admin/estoque");
  const settlement = await settleReturnRefund(request.id);
  return {
    ok: true,
    ...(settlement.pending
      ? { warning: "Itens recebidos; o reembolso está sendo processado pelo Stripe." }
      : !settlement.ok
        ? { warning: settlement.error ?? "Itens recebidos, mas a liquidação precisa ser refeita." }
        : {}),
  };
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
