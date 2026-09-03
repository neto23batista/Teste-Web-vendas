"use client";

import { Gift, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/utils";
import type { CheckoutQuote } from "@/contracts/commerce";
import type { DeliveryMethod } from "@/contracts/commerce";

export function CheckoutSummary({
  coupon,
  setCoupon,
  quote,
  quoteError,
  quoteRefreshing,
  canQuote,
  retryQuote,
  usePoints,
  setUsePoints,
  maxRedeem,
  maxRedeemDiscount,
  points,
  delivery,
  pending,
  amounts,
}: {
  coupon: string;
  setCoupon: (value: string) => void;
  quote: CheckoutQuote | null;
  quoteError: string | null;
  quoteRefreshing: boolean;
  canQuote: boolean;
  retryQuote: () => void;
  usePoints: boolean;
  setUsePoints: (value: boolean) => void;
  maxRedeem: number;
  maxRedeemDiscount: number;
  points: number;
  delivery: DeliveryMethod;
  pending: boolean;
  amounts: {
    subtotal: number;
    shipping: number | null;
    redeemDiscount: number;
    total: number | null;
  };
}) {
  const {
    subtotal: displayedSubtotal,
    shipping: displayedShipping,
    redeemDiscount: displayedRedeemDiscount,
    total: displayedTotal,
  } = amounts;
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit" aria-label="Resumo e confirmação">
      <fieldset disabled={pending} className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 id="checkout-review" tabIndex={-1} className="flex scroll-mt-28 items-center gap-2.5 rounded-lg font-bold">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-surface text-sm font-extrabold text-info">
            4
          </span>
          Revisão do pedido
        </h2>
        <Field label="Cupom de desconto" htmlFor="coupon">
          <Input
            id="coupon"
            name="coupon"
            placeholder="Ex.: BEMVINDO10"
            value={coupon}
            onChange={(event) => setCoupon(event.target.value)}
          />
        </Field>
        {quoteError && (
          <p role="alert" className="text-sm font-semibold text-danger-500">
            {quoteError}
          </p>
        )}

        {quoteError && canQuote && (
          <Button type="button" onClick={retryQuote} className="w-full">
            Recalcular pedido
          </Button>
        )}

        {/* Resgate de pontos de fidelidade */}
        <input
          type="hidden"
          name="redeemPoints"
          value={usePoints ? (quote?.redeemPoints ?? 0) : 0}
        />
        {maxRedeem > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:border-brand-300">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span className="text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Gift className="size-4 text-brand-600 dark:text-brand-400" />
                Usar {maxRedeem.toLocaleString("pt-BR")} pontos
              </span>
              <span className="block text-muted-foreground">
                Abate {formatBRL(maxRedeemDiscount)} · você tem{" "}
                {points.toLocaleString("pt-BR")} pts
              </span>
            </span>
          </label>
        )}

        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-semibold">{formatBRL(displayedSubtotal)}</dd>
          </div>
          {quote && quote.couponDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Cupom{quote.couponCode ? ` (${quote.couponCode})` : ""}
              </dt>
              <dd className="font-semibold text-success-600">
                −{formatBRL(quote.couponDiscount)}
              </dd>
            </div>
          )}
          {displayedRedeemDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pontos de fidelidade</dt>
              <dd className="font-semibold text-success-600">
                −{formatBRL(displayedRedeemDiscount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Frete{delivery === "express" ? " · Entrega Rápida" : ""}
            </dt>
            <dd className="font-semibold">
              {displayedShipping === 0 ? (
                <span className="text-success-600">Grátis</span>
              ) : (
                displayedShipping === null ? "A calcular" : formatBRL(displayedShipping)
              )}
            </dd>
          </div>
        </dl>
        <div className="flex items-end justify-between border-t border-border pt-4">
          <span className="font-bold">Total</span>
          <span
            aria-live="polite"
            aria-busy={quoteRefreshing}
            className="text-2xl font-extrabold text-brand-700 dark:text-brand-400"
          >
            {quoteRefreshing ? "Calculando…" : displayedTotal === null ? "A calcular" : formatBRL(displayedTotal)}
          </span>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || quoteRefreshing || !quote}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ShieldCheck className="size-5" />
          )}
          {pending ? "Confirmando pedido…" : "Finalizar pedido"}
        </Button>
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          Ambiente seguro · total calculado e validado no servidor
        </p>
        <noscript>
          <p role="status" className="rounded-xl border border-border p-3 text-sm">
            Ative o JavaScript para consultar frete e estoque antes de confirmar.
            Sua sacola permanece salva; nenhum pedido foi enviado.
          </p>
        </noscript>
      </fieldset>
    </aside>
  );
}
