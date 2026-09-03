import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCheckoutView } from "@/server/queries/checkout";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const checkout = await getCheckoutView();
  if (!checkout) redirect("/sacola");

  return (
    <div className="aurora">
      <div className="container-page py-6 md:py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
        Revisão e pagamento
      </p>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight md:text-3xl">
        Finalizar compra
      </h1>
      <CheckoutForm
        initialCheckoutAttempt={randomUUID()}
        {...checkout}
      />
      </div>
    </div>
  );
}
