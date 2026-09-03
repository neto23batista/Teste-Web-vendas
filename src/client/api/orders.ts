import { reorder as reorderAction } from "@/actions/store/reorder";
import { orderStatusSchema, pendingOrdersSchema } from "@/contracts/orders";
import { requestJson, type RequestOptions } from "@/client/api/http";
import { adaptAction } from "@/client/api/result";
import { invalidateCatalog } from "@/client/api/cache";

export { cancelMyOrder } from "@/client/api/checkout";
export type { OrderStatusDto, PendingOrdersDto } from "@/contracts/orders";
export const reorder = adaptAction(reorderAction, { invalidate: invalidateCatalog, failureDefaults: { added: 0, skipped: 0 } });
export function getOrderStatus(number: string, options: RequestOptions = {}) {
  return requestJson(`/api/orders/${encodeURIComponent(number)}/status`, orderStatusSchema, options);
}
export function getPendingOrders(unit?: string, options: RequestOptions = {}) {
  return requestJson(`/api/admin/orders/pending${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`, pendingOrdersSchema, options);
}
