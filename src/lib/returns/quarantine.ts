import type { Prisma } from "@prisma/client";
import { changeInventory, type InventoryMovementActor } from "@/lib/inventory/movements";
import { inventoryLotDateCutoff } from "@/lib/inventory/lots";

/** Falha esperada da conferência sanitária; a mensagem vai para o operador. */
export class ReturnDispositionError extends Error {}

export type OriginLot = {
  lotId: string;
  lotCode: string;
  expiresAt: Date;
  /** Quanto ESTE lote forneceu para a venda — o teto do que pode voltar a ele. */
  soldQty: number;
};

/**
 * Reconstrói de qual lote saiu o item vendido.
 *
 * O elo existe porque a reserva de estoque registra a alocação por lote no
 * momento da venda (`InventoryReservationLot`), e a reserva é única por item do
 * pedido. Sem esse registro — pedidos anteriores à migração de reservas, ou
 * saldo legado sem lote — não há origem rastreável, e a devolução NÃO pode
 * virar estoque vendável: é exatamente o buraco que deixava medicamento voltar
 * à prateleira sem lote nem validade.
 *
 * Devolve os lotes na ordem em que a venda os consumiu (FEFO), que é a ordem em
 * que devem ser repostos.
 */
export async function findOriginLots(
  tx: Prisma.TransactionClient,
  orderItemId: string,
): Promise<OriginLot[]> {
  const reservation = await tx.inventoryReservation.findUnique({
    where: { orderItemId },
    select: {
      allocations: {
        select: {
          qty: true,
          lot: { select: { id: true, lotCode: true, expiresAt: true } },
        },
      },
    },
  });
  if (!reservation) return [];
  return reservation.allocations
    .map((allocation) => ({
      lotId: allocation.lot.id,
      lotCode: allocation.lot.lotCode,
      expiresAt: allocation.lot.expiresAt,
      soldQty: allocation.qty,
    }))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

export type RestockPlan = {
  lotId: string;
  lotCode: string;
  qty: number;
};

/**
 * Decide para onde cada unidade devolvida volta, ou explica por que não pode
 * voltar. Não escreve nada — separar o cálculo da escrita deixa o motivo da
 * recusa disponível para a interface antes de qualquer efeito.
 */
export function planRestock(
  lots: readonly OriginLot[],
  qty: number,
  now = new Date(),
): RestockPlan[] {
  if (qty <= 0) throw new ReturnDispositionError("Informe uma quantidade maior que zero.");
  if (lots.length === 0) {
    throw new ReturnDispositionError(
      "Sem lote de origem rastreável: este item não pode voltar ao estoque. Descarte-o ou registre um lote novo em Compras, com validade conferida na embalagem.",
    );
  }

  const cutoff = inventoryLotDateCutoff(now);
  const expired = lots.filter((lot) => lot.expiresAt < cutoff);
  const usable = lots.filter((lot) => lot.expiresAt >= cutoff);
  const capacity = usable.reduce((sum, lot) => sum + lot.soldQty, 0);

  if (capacity < qty) {
    throw new ReturnDispositionError(
      expired.length > 0
        ? `O lote de origem (${expired.map((lot) => lot.lotCode).join(", ")}) está vencido: este item não volta ao estoque. Registre o descarte.`
        : "A quantidade informada é maior do que saiu do lote de origem.",
    );
  }

  const plan: RestockPlan[] = [];
  let remaining = qty;
  for (const lot of usable) {
    if (remaining <= 0) break;
    const take = Math.min(lot.soldQty, remaining);
    plan.push({ lotId: lot.lotId, lotCode: lot.lotCode, qty: take });
    remaining -= take;
  }
  return plan;
}

/**
 * Executa a liberação: devolve as unidades ao lote de origem E ao estoque
 * agregado, na mesma transação. As duas pontas andam juntas de propósito —
 * mexer só no estoque foi o que criou saldo vendável sem lote.
 */
export async function restockToOriginLots(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    pharmacyId: string;
    plan: readonly RestockPlan[];
    reason: string;
    referenceId: string;
    actor: InventoryMovementActor;
  },
): Promise<void> {
  const total = input.plan.reduce((sum, entry) => sum + entry.qty, 0);
  if (total <= 0) return;

  for (const entry of input.plan) {
    await tx.inventoryLot.update({
      where: { id: entry.lotId },
      data: { qty: { increment: entry.qty } },
    });
  }

  await changeInventory(tx, {
    productId: input.productId,
    pharmacyId: input.pharmacyId,
    delta: total,
    kind: "RETURN",
    reason: input.reason,
    referenceType: "RETURN_REQUEST",
    referenceId: input.referenceId,
    actor: input.actor,
  });
}
