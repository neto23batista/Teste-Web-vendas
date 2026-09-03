import type { ActionMetadata } from "@/contracts/result";

/** Compatibility states are presentation contracts, not imports from server actions. */
export type MutationState = { ok: boolean; error?: string; warning?: string } & ActionMetadata;
export type MfaBeginState = ({ error?: string; secret?: string; qrDataUrl?: string } & ActionMetadata) | undefined;
export type MfaConfirmState = ({ error?: string; recoveryCodes?: string[] } & ActionMetadata) | undefined;
export type MfaDisableState = ({ error?: string; success?: boolean } & ActionMetadata) | undefined;
export type ReturnActionResult = MutationState;
export type SubscriptionActionResult = MutationState;
export type LotActionResult = MutationState;
export type PaymentActionResult = MutationState;
export type PharmacyResult = MutationState;
export type TeamResult = MutationState & { setupUrl?: string };
export type UnitOfferValues = { price: string; promoPrice: string; costPrice: string; sku: string; ean: string };
export type ImportResult = MutationState & { created: number; updated: number; errors: string[] };
export type ImportStatementResult = MutationState & { imported: number; duplicated: number; matched: number };
export type SetPharmacyResult = (
  | { ok: true; pharmacyId: string; name: string }
  | { ok: false; error: string }
) & ActionMetadata;
