"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/actions/store/checkout";
import { useCheckoutQuote } from "@/hooks/use-checkout-quote";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/commerce/loyalty";
import {
  deliveryOptions,
  DEFAULT_SHIPPING_CONFIG,
  type DeliveryMethod,
} from "@/lib/shipping/rates";
import {
  defaultPaymentMethod,
  type PaymentMethodId,
} from "@/lib/payments/methods";
import { lookupCep } from "@/lib/shipping/viacep";
import { CheckoutAddressSection } from "./checkout/address-section";
import { CheckoutDeliverySection } from "./checkout/delivery-section";
import { CheckoutPaymentSection } from "./checkout/payment-section";
import { CheckoutSummary } from "./checkout/summary";
import type { CheckoutFormProps } from "./checkout/types";

export function CheckoutForm({
  initialCheckoutAttempt,
  addresses,
  subtotal,
  points,
  shippingConfig = DEFAULT_SHIPPING_CONFIG,
  defaultKm = 0,
  hasCpf = false,
  availability,
}: CheckoutFormProps) {
  const errorRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(placeOrder, undefined);
  const [checkoutAttempt, setCheckoutAttempt] = React.useState(
    initialCheckoutAttempt,
  );

  // O banner de erro fica no topo do form; o toast garante que o aviso seja
  // visto mesmo com a página rolada até o botão (ex.: rate limit no duplo clique).
  React.useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      errorRef.current?.focus();
      // Uma tentativa que chegou a criar/cancelar pedido não deve ser reutilizada
      // no retry; um novo token continua idempotente contra duplo clique.
      const timer = window.setTimeout(
        () => setCheckoutAttempt(crypto.randomUUID()),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [state]);
  const [addressId, setAddressId] = React.useState(addresses[0]?.id ?? "new");
  const [method, setMethod] = React.useState<PaymentMethodId>(
    defaultPaymentMethod(availability),
  );
  const [delivery, setDelivery] = React.useState<DeliveryMethod>("standard");
  const [newZip, setNewZip] = React.useState("");
  const [coupon, setCoupon] = React.useState("");
  const [cepLoading, setCepLoading] = React.useState(false);
  const isNew = addressId === "new";

  // Frete pela distância (km) do endereço + modalidade. Endereço novo ainda não
  // tem km resolvido, então usa o default (o servidor recalcula na confirmação).
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const currentKm = isNew ? defaultKm : (selectedAddress?.km ?? defaultKm);
  const options = deliveryOptions(subtotal, currentKm, shippingConfig);
  const shipping =
    options.find((o) => o.method === delivery)?.price ?? options[0].price;

  // Resgate de pontos (cálculo ao vivo; o servidor revalida o saldo na confirmação).
  const maxRedeem = maxRedeemablePoints(points, subtotal);
  const [usePoints, setUsePoints] = React.useState(false);
  const redeemPoints = usePoints ? maxRedeem : 0;
  const redeemDiscount = pointsToBRL(redeemPoints);
  const total = Math.max(0, subtotal - redeemDiscount) + shipping;
  const quoteState = useCheckoutQuote({
    addressId,
    isNew,
    newZip,
    coupon,
    redeemPoints,
    delivery,
  });
  const { quote } = quoteState;

  const displayedShipping = quote?.shipping ?? shipping;
  const displayedSubtotal = quote?.subtotal ?? subtotal;
  const displayedRedeemDiscount = quote?.redeemDiscount ?? redeemDiscount;
  const displayedTotal = quote?.total ?? total;

  async function handleCepBlur() {
    setCepLoading(true);
    const found = await lookupCep(newZip).finally(() => setCepLoading(false));
    if (!found || !formRef.current) return;
    const set = (name: string, value: string) => {
      const el = formRef.current!.elements.namedItem(
        name,
      ) as HTMLInputElement | null;
      if (el && value) el.value = value;
    };
    set("street", found.street);
    set("district", found.district);
    set("city", found.city);
    set("state", found.state);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <input type="hidden" name="checkoutAttempt" value={checkoutAttempt} />
      <div className="space-y-6">
        {state?.error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500"
          >
            <AlertCircle className="size-4 shrink-0" /> {state.error}
          </div>
        )}
        <CheckoutAddressSection
          addresses={addresses}
          addressId={addressId}
          setAddressId={setAddressId}
          isNew={isNew}
          newZip={newZip}
          setNewZip={setNewZip}
          cepLoading={cepLoading}
          handleCepBlur={handleCepBlur}
        />
        <CheckoutDeliverySection
          options={options}
          delivery={delivery}
          setDelivery={setDelivery}
        />
        <CheckoutPaymentSection
          availability={availability}
          method={method}
          setMethod={setMethod}
          hasCpf={hasCpf}
        />
        {/* Observações */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2
            id="checkout-notes-label"
            className="flex items-center gap-2 font-bold"
          >
            <MessageSquareText className="size-5 text-brand-600 dark:text-brand-400" />{" "}
            Observações{" "}
            <span className="text-sm font-medium text-muted-foreground">
              (opcional)
            </span>
          </h2>
          <textarea
            name="notes"
            aria-labelledby="checkout-notes-label"
            rows={3}
            maxLength={500}
            placeholder="Ex.: entregar na portaria, interfone 12, troco para R$ 100…"
            className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
          />
        </section>
      </div>
      <CheckoutSummary
        {...quoteState}
        coupon={coupon}
        setCoupon={setCoupon}
        usePoints={usePoints}
        setUsePoints={setUsePoints}
        maxRedeem={maxRedeem}
        points={points}
        delivery={delivery}
        pending={pending}
        amounts={{
          subtotal: displayedSubtotal,
          shipping: displayedShipping,
          redeemDiscount: displayedRedeemDiscount,
          total: displayedTotal,
        }}
      />
    </form>
  );
}
