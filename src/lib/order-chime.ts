/**
 * Sinal leve de "pedidos a processar" da unidade, usado pelo som de pedido novo
 * no painel (src/components/admin/order-chime.tsx). Mantido puro e sem I/O para
 * ser testável — o endpoint /api/admin/orders/pending produz o OrderSignal.
 */
export type OrderSignal = {
  /** Pedidos PAID/PREPARING da unidade (igual ao badge do admin). */
  count: number;
  /** createdAt (ISO) do pedido mais recente nesse conjunto — null se vazio. */
  latestAt: string | null;
};

/**
 * Chegou pedido novo? Compara o sinal anterior com o atual.
 * - `prev === null` (primeira leitura / baseline) → false (não toca ao abrir).
 * - `latestAt` avançou → um pedido MAIS RECENTE que o já visto entrou.
 * - `count` subiu → cobre o caso do PIX antigo que só é pago depois (createdAt
 *   mais velho que os já vistos, mas ainda assim um pedido novo na fila).
 */
export function isNewOrder(prev: OrderSignal | null, next: OrderSignal): boolean {
  if (!prev) return false;
  if (next.count > prev.count) return true;
  if (next.latestAt && (!prev.latestAt || next.latestAt > prev.latestAt)) {
    return true;
  }
  return false;
}
