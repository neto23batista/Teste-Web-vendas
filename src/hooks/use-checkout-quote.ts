"use client";

import { useEffect, useState, useTransition } from "react";
import { previewCheckoutQuote } from "@/client/api/checkout";
import type { DeliveryMethod } from "@/lib/shipping/rates";

type PreviewResult = Awaited<ReturnType<typeof previewCheckoutQuote>>;

type QuoteInput = {
  revision: string;
  addressId: string;
  isNew: boolean;
  newZip: string;
  coupon: string;
  redeemPoints: number;
  delivery: DeliveryMethod;
};

/** Debounce e descarte de respostas antigas; os valores vêm sempre do servidor. */
export function useCheckoutQuote({
  revision,
  addressId,
  isNew,
  newZip,
  coupon,
  redeemPoints,
  delivery,
}: QuoteInput) {
  const zipDigits = newZip.replace(/\D/g, "");
  const canQuote = !isNew || zipDigits.length === 8;
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([
    revision,
    isNew ? null : addressId,
    isNew ? zipDigits : null,
    coupon,
    redeemPoints,
    delivery,
    retry,
  ]);
  const [response, setResponse] = useState<{
    key: string;
    result: PreviewResult;
  } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    if (!canQuote)
      return () => {
        active = false;
      };

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        let result: PreviewResult;
        try {
          result = await previewCheckoutQuote({
            addressId: isNew ? null : addressId,
            zip: isNew ? newZip : null,
            coupon,
            redeemPoints,
            deliveryMethod: delivery,
          });
        } catch {
          result = {
            ok: false,
            error:
              "Não foi possível atualizar o total. Tente calcular novamente.",
          };
        }
        if (active) setResponse({ key: requestKey, result });
      });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    addressId,
    canQuote,
    coupon,
    delivery,
    isNew,
    newZip,
    redeemPoints,
    requestKey,
    revision,
  ]);

  const current = response?.key === requestKey ? response.result : null;
  const quoteError = !canQuote
    ? zipDigits.length > 0
      ? "Informe um CEP com 8 dígitos."
      : null
    : current && !current.ok
      ? current.error
      : null;

  return {
    quote: current?.ok ? current.quote : null,
    quoteError,
    quoteRefreshing: canQuote && current === null,
    canQuote,
    retryQuote: () => setRetry((attempt) => attempt + 1),
  };
}
