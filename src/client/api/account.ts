import * as addresses from "@/actions/account/addresses";
import * as favorites from "@/actions/account/favorites";
import * as subscriptions from "@/actions/account/subscriptions";
import * as returns from "@/actions/account/returns";
import { dataExportStateSchema, dataExportRequestSchema } from "@/contracts/account";
import { requestJson, type RequestOptions } from "@/client/api/http";
import { adaptAction } from "@/client/api/result";
import { invalidateCatalog } from "@/client/api/cache";

export {
  createAddress, updateAddress, updateProfile, changePassword, deleteAccount,
  beginMfaSetup, confirmMfaSetup, disableMfa, requestPasswordReset, resetPassword,
} from "@/client/api/form-actions";
export type { FormState as AddressState, FormState as ProfileState, FormState as DeleteAccountState, FormState as ResetState } from "@/contracts/result";
export type { MfaBeginState, MfaConfirmState, MfaDisableState, ReturnActionResult, SubscriptionActionResult } from "@/contracts/forms";
export type { ExportState } from "@/contracts/account";
export { lookupCep, lookupCepResult } from "@/client/api/address";
export type { CepResult } from "@/client/api/address";

export const deleteAddress = adaptAction(addresses.deleteAddress);
export const setDefaultAddress = adaptAction(addresses.setDefaultAddress);
export const toggleFavorite = adaptAction(favorites.toggleFavorite);
export const mergeFavorites = adaptAction(favorites.mergeFavorites, { failureDefaults: { ids: [] } });
export const subscribeToProduct = adaptAction(subscriptions.subscribeToProduct);
export const pauseSubscription = adaptAction(subscriptions.pauseSubscription);
export const resumeSubscription = adaptAction(subscriptions.resumeSubscription);
export const cancelSubscription = adaptAction(subscriptions.cancelSubscription);
export const updateSubscriptionInterval = adaptAction(subscriptions.updateSubscriptionInterval);
export const refillNow = adaptAction(subscriptions.refillNow, { invalidate: invalidateCatalog });
export const requestReturn = adaptAction(returns.requestReturn);
export const cancelReturnRequest = adaptAction(returns.cancelReturnRequest);
export const decideReturnRequest = adaptAction(returns.decideReturnRequest);
export const receiveReturnRequest = adaptAction(returns.receiveReturnRequest, { invalidate: invalidateCatalog });
export const decideReturnItemDisposition = adaptAction(returns.decideReturnItemDisposition, { invalidate: invalidateCatalog });
export const retryReturnRefund = adaptAction(returns.retryReturnRefund);

export const DATA_EXPORT_DOWNLOAD_URL = "/api/account/export";
export function readDataExport(options: RequestOptions = {}) {
  return requestJson("/api/account/export?status=1", dataExportStateSchema, options);
}
export function requestDataExport(options: RequestOptions = {}) {
  return requestJson("/api/account/export", dataExportRequestSchema, { ...options, method: "POST" });
}
