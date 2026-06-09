"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import type { CouponFormState } from "@/actions/admin-coupons";

type Coupon = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minTotal: number;
  usageLimit: number | null;
  expiresAt: Date | null;
  active: boolean;
};

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CouponForm({
  action,
  coupon,
  submitLabel = "Salvar cupom",
}: {
  action: (prev: CouponFormState, fd: FormData) => Promise<CouponFormState>;
  coupon?: Coupon;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<"PERCENT" | "FIXED">(coupon?.type ?? "PERCENT");

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <Field label="Código do cupom" htmlFor="code" hint="Letras e números, sem espaços. Ex.: BEMVINDO10">
          <Input
            id="code"
            name="code"
            defaultValue={coupon?.code}
            placeholder="PROMO20"
            className="uppercase"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de desconto" htmlFor="type">
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
              className={inputCls}
            >
              <option value="PERCENT">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
          </Field>
          <Field
            label={type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}
            htmlFor="value"
          >
            <Input
              id="value"
              name="value"
              inputMode="decimal"
              defaultValue={coupon?.value}
              placeholder={type === "PERCENT" ? "10" : "15,00"}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compra mínima (R$)" htmlFor="minTotal" hint="0 para não exigir mínimo">
            <Input id="minTotal" name="minTotal" inputMode="decimal" defaultValue={coupon?.minTotal ?? 0} />
          </Field>
          <Field label="Limite de usos" htmlFor="usageLimit" hint="Vazio = ilimitado">
            <Input id="usageLimit" name="usageLimit" inputMode="numeric" defaultValue={coupon?.usageLimit ?? ""} placeholder="Ilimitado" />
          </Field>
        </div>

        <Field label="Validade" htmlFor="expiresAt" hint="Vazio = sem data de expiração">
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={toDateInput(coupon?.expiresAt ?? null)} />
        </Field>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="active"
            defaultChecked={coupon ? coupon.active : true}
            className="size-4 rounded border-border accent-brand-600"
          />
          Cupom ativo (disponível para os clientes)
        </label>
      </section>

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        {submitLabel}
      </Button>
    </form>
  );
}
