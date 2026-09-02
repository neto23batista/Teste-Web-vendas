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
export {
  generateOrderNumber,
  createOrder,
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
} from "@/lib/orders/payment-events";
export type { StripeRefundUpdate } from "@/lib/orders/payment-events";
export { transferOrder } from "@/lib/orders/transfer";
