import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/contracts/domain";

export const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES), paymentStatus: z.enum(PAYMENT_STATUSES).nullable() });
export type OrderStatusDto = z.infer<typeof orderStatusSchema>;
export const pendingOrdersSchema = z.object({
  count: z.number().int().nonnegative(), latestAt: z.iso.datetime().nullable(), latestNumber: z.string().nullable(),
});
export type PendingOrdersDto = z.infer<typeof pendingOrdersSchema>;
export type CheckoutPreviewInput = {
  addressId?: string | null; zip?: string | null; coupon?: string | null;
  redeemPoints?: number; deliveryMethod?: string | null;
};
export type CheckoutQuoteDto = {
  subtotal: number; couponCode: string | null; couponDiscount: number; redeemPoints: number;
  redeemDiscount: number; discount: number; shipping: number; total: number; deliveryMethod: "standard" | "express";
};
