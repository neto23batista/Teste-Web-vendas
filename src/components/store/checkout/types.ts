import type { PaymentAvailability } from "@/lib/payments/methods";
import type { ShippingConfig } from "@/lib/shipping/rates";

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
  shippingConfig?: ShippingConfig;
  defaultKm?: number;
  hasCpf?: boolean;
  availability: PaymentAvailability;
};
