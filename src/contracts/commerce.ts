/** Presentation DTOs contain serialized values, never database numeric wrappers. */
export type CartItemView = {
  id: string;
  qty: number;
  product: {
    id: string; name: string; slug: string; emoji: string | null;
    price: number; promoPrice: number | null; stock: number; images: { url: string }[];
  };
};
export type CartView = {
  id: string; pharmacyId: string | null; items: CartItemView[]; subtotal: number; count: number;
};
export type DeliveryMethod = "standard" | "express";
export type ShippingConfig = {
  freeMin: number; freeRadiusKm: number; perKm: number; expressFlat: number; defaultKm: number;
};
export type DeliveryOption = { method: DeliveryMethod; label: string; eta: string; price: number };
export type PaymentMethodId = "pix" | "card" | "cash";
export type PaymentAvailability = { stripeConfigured: boolean; pixEnabled: boolean };
export type { CheckoutQuoteDto, CheckoutQuoteDto as CheckoutQuote } from "@/contracts/orders";
