import type { Prisma } from "@prisma/client";

type LotWriter = Pick<Prisma.TransactionClient, "inventoryLot">;

/**
 * Realinha o saldo dos lotes depois de uma baixa que NÃO passou pelo fluxo de
 * reservas — hoje só os caminhos legados: a confirmação de um pedido criado
 * antes da migração de reservas e a transferência desse mesmo tipo de pedido.
 *
 * Por que isto precisa existir: `inventoryLotAvailability` trata
 * `sum(lot.qty) > Inventory.stock` como invariante quebrada e recusa reservar.
 * Esses dois caminhos reduziam o estoque agregado sem tocar nos lotes, então uma
 * única confirmação de pedido legado numa unidade com lotes rastreados travava
 * o produto ali: toda compra seguinte falhava, e nem `adjustStock` nem a
 * contagem de catálogo conseguiam corrigir — só uma baixa manual de lote.
 *
 * A regra é a mínima honesta: consome apenas o excesso, na ordem FEFO (o lote
 * que venceria primeiro é o que a venda teria levado). Não inventa lote novo
 * nem redistribui saldo — se sobrar estoque sem lote, ele continua sendo o
 * saldo legado que já era.
 *
 * Devolve quantas unidades saíram de lote rastreado (0 quando não havia
 * excesso, que é o caso comum de unidade sem lotes).
 */
export async function reconcileLotsAfterUntrackedDecrease(
  tx: LotWriter,
  input: { productId: string; pharmacyId: string; stockAfter: number },
): Promise<number> {
  const lots = await tx.inventoryLot.findMany({
    where: {
      productId: input.productId,
      pharmacyId: input.pharmacyId,
      qty: { gt: 0 },
    },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    select: { id: true, qty: true },
  });
  const trackedQty = lots.reduce((sum, lot) => sum + lot.qty, 0);

  let excess = trackedQty - input.stockAfter;
  if (excess <= 0) return 0;

  let consumed = 0;
  for (const lot of lots) {
    if (excess <= 0) break;
    const take = Math.min(lot.qty, excess);
    // Condicional pelo saldo lido: se outra transação mexeu no lote nesse meio
    // tempo, esta some sem baixar — o realinhamento é best-effort por natureza,
    // e forçar aqui geraria saldo negativo de lote.
    const changed = await tx.inventoryLot.updateMany({
      where: { id: lot.id, qty: { gte: take } },
      data: { qty: { decrement: take } },
    });
    if (changed.count !== 1) continue;
    excess -= take;
    consumed += take;
  }
  return consumed;
}
