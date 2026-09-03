/** Fachada pública do domínio; regras implementadas em módulos especializados. */
export {
  ORDER_STATUSES,
  allowedOrderTransitions,
  isValidOrderTransition,
  MAX_ITEM_QUANTITY,
  isValidItemQuantity,
  isValidStock,
  validateOrderFinancials,
} from "@/lib/orders/policy";
// `createOrder` NÃO entra na fachada: ele grava o pedido sem reservar estoque,
// cupom ou pontos, e existir aqui convidava a criar pedido por fora do checkout.
// Quem realmente precisa dele (só os testes, hoje) importa de
// "@/lib/orders/creation" e assume a responsabilidade explicitamente.
export {
  generateOrderNumber,
  CheckoutReservationError,
  createCheckoutOrder,
} from "@/lib/orders/creation";
export type { CreateInput, CheckoutReservations } from "@/lib/orders/creation";
export {
  fulfillOrder,
  transitionOrderStatus,
  markOrderDelivered,
} from "@/lib/orders/fulfillment";
export type { DeliveryProofInput } from "@/lib/orders/fulfillment";
export { processOrderRefund } from "@/lib/orders/refunds";
export { cancelOrder } from "@/lib/orders/cancellation";
export type { CancelOrderOptions } from "@/lib/orders/cancellation";
export {
  confirmStripePayment,
  failStripePayment,
  recordStripeRefund,
  quarantinePayment,
} from "@/lib/orders/payment-events";
export type {
  StripeRefundUpdate,
  PaymentQuarantineInput,
} from "@/lib/orders/payment-events";
export {
  transferOrder,
  TRANSFERABLE_STATUSES,
  OrderTransferConflictError,
} from "@/lib/orders/transfer";
