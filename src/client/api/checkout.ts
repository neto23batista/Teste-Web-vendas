import * as actions from "@/actions/store/checkout";
import { adaptAction, withReadTimeout } from "@/client/api/result";
import { invalidateCatalog } from "@/client/api/cache";

export { placeOrder } from "@/client/api/form-actions";
export type { CheckoutPreviewInput, CheckoutQuoteDto } from "@/contracts/orders";
export type { FormState as CheckoutState } from "@/contracts/result";
export const previewCheckoutQuote = withReadTimeout(adaptAction(actions.previewCheckoutQuote));
export const cancelMyOrder = adaptAction(actions.cancelMyOrder, { invalidate: invalidateCatalog });
