import type { PaymentAvailability, PaymentMethodId } from "@/contracts/commerce";
import type { DeliveryOption } from "@/contracts/commerce";

export type CheckoutAddress = {
  id: string;
  label: string;
  recipient: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  zip: string;
  /** Distância (km) resolvida pela faixa de CEP da unidade. */
  km: number;
  /** O CEP pertence a uma faixa ativa da unidade selecionada. */
  covered: boolean;
};

export type CheckoutFormProps = {
  initialCheckoutAttempt: string;
  addresses: CheckoutAddress[];
  subtotal: number;
  points: number;
  initialDeliveryOptions: DeliveryOption[];
  deliveryOptionsByAddress: Record<string, DeliveryOption[]>;
  maxRedeem: number;
  maxRedeemDiscount: number;
  initialPaymentMethod: PaymentMethodId;
  hasCpf?: boolean;
  availability: PaymentAvailability;
};
