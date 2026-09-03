"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/client/api/checkout";
import { useRouter } from "next/navigation";
import { useCheckoutQuote } from "@/hooks/use-checkout-quote";
import type { DeliveryMethod } from "@/contracts/commerce";
import type { PaymentMethodId } from "@/contracts/commerce";
import { lookupCep } from "@/client/api/account";
import { CheckoutAddressSection } from "./address-section";
import { CheckoutDeliverySection } from "./delivery-section";
import { CheckoutPaymentSection } from "./payment-section";
import { CheckoutSummary } from "./summary";
import type { CheckoutFormProps } from "./types";

export function CheckoutForm({
  initialCheckoutAttempt,
  addresses,
  subtotal,
  points,
  initialDeliveryOptions,
  deliveryOptionsByAddress,
  maxRedeem,
  maxRedeemDiscount,
  initialPaymentMethod,
  hasCpf = false,
  availability,
}: CheckoutFormProps) {
  const router = useRouter();
  const submissionLock = React.useRef(false);
  const cepVersion = React.useRef(0);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (previous: Awaited<ReturnType<typeof placeOrder>> | undefined, form: FormData) => {
    try { return await placeOrder(previous, form); }
    finally { submissionLock.current = false; }
  }, undefined);
  const [checkoutAttempt, setCheckoutAttempt] = React.useState(
    initialCheckoutAttempt,
  );

  // O banner de erro fica no topo do form; o toast garante que o aviso seja
  // visto mesmo com a página rolada até o botão (ex.: rate limit no duplo clique).
  React.useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      errorRef.current?.focus();
      router.refresh();
      // A lost acknowledgement may have committed the order. Reuse its key.
      if (!["NETWORK_ERROR", "TIMEOUT", "INTERNAL_ERROR", "INVALID_RESPONSE"].includes(state.code ?? "INTERNAL_ERROR")) {
        const timer = window.setTimeout(() => setCheckoutAttempt(crypto.randomUUID()), 0);
        return () => window.clearTimeout(timer);
      }
    }
  }, [state, router]);
  const [addressId, setAddressId] = React.useState(addresses[0]?.id ?? "new");
  const [method, setMethod] = React.useState<PaymentMethodId>(
    initialPaymentMethod,
  );
  const [delivery, setDelivery] = React.useState<DeliveryMethod>("standard");
  const [newZip, setNewZip] = React.useState("");
  const [coupon, setCoupon] = React.useState("");
  const [cepLoading, setCepLoading] = React.useState(false);
  const isNew = addressId === "new";

  const options = isNew ? initialDeliveryOptions : (deliveryOptionsByAddress[addressId] ?? initialDeliveryOptions);
  const [usePoints, setUsePoints] = React.useState(false);
  const redeemPoints = usePoints ? maxRedeem : 0;
  const quoteState = useCheckoutQuote({
    revision: initialCheckoutAttempt,
    addressId,
    isNew,
    newZip,
    coupon,
    redeemPoints,
    delivery,
  });
  const { quote } = quoteState;

  const displayedShipping = quote?.shipping ?? null;
  const displayedSubtotal = quote?.subtotal ?? subtotal;
  const displayedRedeemDiscount = quote?.redeemDiscount ?? 0;
  const displayedTotal = quote?.total ?? null;

  async function handleCepBlur() {
    const version = ++cepVersion.current;
    setCepLoading(true);
    const found = await lookupCep(newZip).finally(() => { if (version === cepVersion.current) setCepLoading(false); });
    if (version !== cepVersion.current || !found || !formRef.current || submissionLock.current) return;
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
      aria-busy={pending}
      onSubmit={(event) => {
        if (submissionLock.current || !quote || quoteState.quoteRefreshing) event.preventDefault();
        else submissionLock.current = true;
      }}
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <input type="hidden" name="checkoutAttempt" value={checkoutAttempt} />
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        {state?.error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500"
          >
            <AlertCircle className="size-4 shrink-0" /> {state.error}
            <button type="button" onClick={() => router.refresh()} className="min-h-11 underline">Atualizar dados</button>
          </div>
        )}
        <CheckoutAddressSection
          addresses={addresses}
          addressId={addressId}
          setAddressId={setAddressId}
          isNew={isNew}
          newZip={newZip}
          setNewZip={(value) => { cepVersion.current += 1; setCepLoading(false); setNewZip(value); }}
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
      </fieldset>
      <CheckoutSummary
        {...quoteState}
        coupon={coupon}
        setCoupon={setCoupon}
        usePoints={usePoints}
        setUsePoints={setUsePoints}
        maxRedeem={maxRedeem}
        maxRedeemDiscount={maxRedeemDiscount}
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
