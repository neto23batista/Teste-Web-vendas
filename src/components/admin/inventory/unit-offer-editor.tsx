"use client";

import * as React from "react";
import { Loader2, Pencil, Save } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { updateUnitOffer } from "@/client/api/admin";

type Props = {
  productId: string;
  pharmacyId: string;
  price: number;
  promoPrice: number | null;
  costPrice: number | null;
  sku: string | null;
  ean: string | null;
};

const moneyInput = (value: number | null) =>
  value == null ? "" : value.toFixed(2).replace(".", ",");

const inputClass =
  "h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-500";

export function UnitOfferEditor(props: Props) {
  const { pending, run } = useConfirmAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run({
      action: () => updateUnitOffer(props.productId, props.pharmacyId, {
        price: String(form.get("price") ?? ""),
        promoPrice: String(form.get("promoPrice") ?? ""),
        costPrice: String(form.get("costPrice") ?? ""),
        sku: String(form.get("sku") ?? ""),
        ean: String(form.get("ean") ?? ""),
      }),
      successMessage: "Oferta da unidade atualizada.",
    });
  }

  return (
    <details className="group min-w-[12rem]">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
        <Pencil className="size-3.5" />
        R$ {props.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        <span className="text-muted-foreground group-open:hidden">· editar</span>
      </summary>
      <form onSubmit={submit} className="mt-3 grid min-w-[18rem] gap-2 rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1 text-[11px] font-semibold">
            Preço
            <input className={inputClass} name="price" inputMode="decimal" defaultValue={moneyInput(props.price)} required />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold">
            Promoção
            <input className={inputClass} name="promoPrice" inputMode="decimal" defaultValue={moneyInput(props.promoPrice)} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold">
            Custo
            <input className={inputClass} name="costPrice" inputMode="decimal" defaultValue={moneyInput(props.costPrice)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[11px] font-semibold">
            SKU da unidade
            <input className={inputClass} name="sku" defaultValue={props.sku ?? ""} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold">
            EAN
            <input className={inputClass} name="ean" inputMode="numeric" defaultValue={props.ean ?? ""} />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar oferta
        </button>
      </form>
    </details>
  );
}
