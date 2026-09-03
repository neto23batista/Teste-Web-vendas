import "server-only";

import { getAdminOrder, getAdminOrders } from "@/lib/admin";
import { requireArea } from "@/lib/auth/session";
import { isOwnerProfile } from "@/lib/auth/permissions";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { getStoreSettings } from "@/lib/settings";
import { allowedOrderTransitions } from "@/lib/orders/policy";
import { TRANSFERABLE_STATUSES } from "@/lib/orders/transfer";
import { ORDER_STATUSES, type OrderStatus } from "@/contracts/domain";

export async function getAdminOrdersView(input: {
  status?: string; q?: string; from?: string; to?: string;
  archived?: boolean; page?: number; unit?: string;
}) {
  const user = await requireArea("pedidos");
  const status = ORDER_STATUSES.includes(input.status as OrderStatus)
    ? input.status as OrderStatus : undefined;
  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page!)) : 1;
  const result = await getAdminOrders({
    status, q: input.q, from: input.from, to: input.to, archived: input.archived,
  }, page, input.unit);
  return {
    ...result,
    items: result.items.map((order) => ({
      id: order.id, number: order.number, customerName: order.customerName,
      customerEmail: order.customerEmail, total: order.total, status: order.status,
      createdAt: order.createdAt, archivedAt: order.archivedAt,
    })),
    status,
    isOwner: isOwnerProfile(user.staffProfile),
  };
}

export async function getAdminOrderDetailView(id: string) {
  const user = await requireArea("pedidos");
  const [row, store, pharmacies] = await Promise.all([
    getAdminOrder(id), getStoreSettings(), listPharmaciesSafe(),
  ]);
  if (!row) return null;
  // O detalhe do provedor permanece no servidor. A operação usa o pedido como referência.
  const order = {
    id: row.id, number: row.number, status: row.status, createdAt: row.createdAt,
    archivedAt: row.archivedAt, notes: row.notes, pharmacyId: row.pharmacyId,
    pharmacy: row.pharmacy, customerName: row.customerName,
    customerEmail: row.customerEmail, customerPhone: row.customerPhone,
    subtotal: row.subtotal, discount: row.discount, shipping: row.shipping, total: row.total,
    couponCode: row.couponCode, paymentMethod: row.paymentMethod,
    shippingRecipient: row.shippingRecipient, shippingStreet: row.shippingStreet,
    shippingNumber: row.shippingNumber, shippingComplement: row.shippingComplement,
    shippingDistrict: row.shippingDistrict, shippingCity: row.shippingCity,
    shippingState: row.shippingState, shippingZip: row.shippingZip,
    items: row.items.map((item) => ({
      id: item.id, name: item.name, price: item.price, qty: item.qty, product: item.product,
    })),
    deliveryProof: row.deliveryProof ? {
      recipientName: row.deliveryProof.recipientName, method: row.deliveryProof.method,
      recipientDocumentLast4: row.deliveryProof.recipientDocumentLast4,
      courierName: row.deliveryProof.courierName, notes: row.deliveryProof.notes,
    } : null,
    payment: row.payment ? {
      status: row.payment.status, lastReconciledAt: row.payment.lastReconciledAt,
      reconciliationAttempts: row.payment.reconciliationAttempts,
      refundError: row.payment.refundError
        ? `O estorno precisa de nova conferência. Referência: pedido ${row.number}.` : null,
      reconciliationError: row.payment.reconciliationError
        ? `Há uma pendência na conciliação. Referência: pedido ${row.number}.` : null,
    } : null,
    returnRequests: row.returnRequests.map((request) => ({
      id: request.id, status: request.status, reason: request.reason,
      customerNotes: request.customerNotes, adminNotes: request.adminNotes,
      requestedAmount: request.requestedAmount, approvedAmount: request.approvedAmount,
      refundStatus: request.refundStatus, requestedAt: request.requestedAt,
      refundError: request.refundError
        ? `Não foi possível confirmar o reembolso. Referência: pedido ${row.number}.` : null,
      items: request.items.map((item) => ({
        id: item.id, qty: item.qty, receivedQty: item.receivedQty,
        restockQty: item.restockQty, disposition: item.disposition, orderItem: item.orderItem,
      })),
    })),
  };
  return {
    order,
    store: { cnpj: store.cnpj, address: store.address, phone: store.phone },
    isOwner: isOwnerProfile(user.staffProfile),
    canTransfer: !row.archivedAt && TRANSFERABLE_STATUSES.includes(row.status),
    hasMultiplePharmacies: pharmacies.length > 1,
    transferTargets: pharmacies.filter((pharmacy) => pharmacy.id !== row.pharmacyId)
      .map(({ id, name }) => ({ id, name })),
    allowedTransitions: allowedOrderTransitions(row.status, row.paymentMethod),
  };
}
