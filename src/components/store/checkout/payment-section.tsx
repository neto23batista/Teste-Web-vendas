"use client";

import { CreditCard, QrCode, Wallet } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  availablePaymentMethods,
  type PaymentAvailability,
  type PaymentMethodId,
} from "@/lib/payments/methods";

const METHOD_INFO: Record<
  PaymentMethodId,
  { label: string; desc: string; icon: typeof QrCode }
> = {
  pix: { label: "Pix", desc: "Aprovação imediata", icon: QrCode },
  card: {
    label: "Cartão de crédito",
    desc: "Pagamento seguro pelo Stripe",
    icon: CreditCard,
  },
  cash: {
    label: "Dinheiro na entrega",
    desc: "Pague ao receber",
    icon: Wallet,
  },
};

export function CheckoutPaymentSection({
  availability,
  method,
  setMethod,
  hasCpf,
}: {
  availability: PaymentAvailability;
  method: PaymentMethodId;
  setMethod: (method: PaymentMethodId) => void;
  hasCpf: boolean;
}) {
  const methods = availablePaymentMethods(availability).map((id) => ({
    id,
    ...METHOD_INFO[id],
  }));
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2.5 font-bold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
          3
        </span>
        Forma de pagamento
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => (
          <label
            key={m.id}
            className={cn(
              "relative cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 rounded-xl border p-4 text-center transition active:scale-[0.98]",
              method === m.id
                ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/25 dark:bg-brand-600/10"
                : "border-border hover:border-brand-300",
            )}
          >
            {method === m.id && (
              <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="size-3"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
            <input
              type="radio"
              name="paymentMethod"
              value={m.id}
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
              className="sr-only"
            />
            <m.icon
              className={cn(
                "mx-auto size-6",
                method === m.id
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-muted-foreground",
              )}
            />
            <p className="mt-2 text-sm font-bold">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </label>
        ))}
      </div>

      {/* PIX exige o CPF do pagador; só pede se o cadastro ainda não tem. */}
      {method === "pix" && !hasCpf && (
        <Field
          label="CPF do pagador"
          htmlFor="cpf"
          hint="O PIX exige o CPF de quem paga. Fica salvo para as próximas compras."
        >
          <Input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            required
            aria-required="true"
          />
        </Field>
      )}
    </section>
  );
}
