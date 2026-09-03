"use client";

import { Truck, Zap } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import type { DeliveryMethod, DeliveryOption } from "@/contracts/commerce";

export function CheckoutDeliverySection({
  options,
  delivery,
  setDelivery,
}: {
  options: DeliveryOption[];
  delivery: DeliveryMethod;
  setDelivery: (method: DeliveryMethod) => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2.5 font-bold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
          2
        </span>
        <Truck className="size-5 text-brand-600 dark:text-brand-400" /> Como
        quer receber
      </h2>
      <input type="hidden" name="deliveryMethod" value={delivery} />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const Icon = o.method === "express" ? Zap : Truck;
          return (
            <label
              key={o.method}
              className={cn(
                "relative cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 rounded-xl border p-4 transition active:scale-[0.98]",
                delivery === o.method
                  ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/25 dark:bg-brand-600/10"
                  : "border-border hover:border-brand-300",
              )}
            >
              <input
                type="radio"
                name="deliveryChoice"
                value={o.method}
                checked={delivery === o.method}
                onChange={() => setDelivery(o.method)}
                className="sr-only"
              />
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-5",
                    delivery === o.method
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-bold">{o.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{o.eta}</p>
              <p className="mt-1.5 text-sm font-extrabold">
                {o.price === 0 ? (
                  <span className="text-success-600">Grátis</span>
                ) : (
                  formatBRL(o.price)
                )}
              </p>
            </label>
          );
        })}
      </div>
    </section>
  );
}
