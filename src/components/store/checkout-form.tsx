"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  AlertCircle,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  CreditCard,
  Wallet,
  FileText,
  ShieldCheck,
  Gift,
  MessageSquareText,
} from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/loyalty";
import {
  shippingFor,
  DEFAULT_SHIPPING_CONFIG,
  type ShippingConfig,
} from "@/lib/shipping";
import { lookupCep } from "@/lib/viacep";
import { formatBRL, cn } from "@/lib/utils";

type Address = {
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
};

const methods = [
  { id: "pix", label: "Pix", desc: "Aprovação imediata", icon: QrCode },
  { id: "card", label: "Cartão de crédito", desc: "Em até 3x sem juros", icon: CreditCard },
  { id: "cash", label: "Dinheiro na entrega", desc: "Pague ao receber", icon: Wallet },
];

export function CheckoutForm({
  addresses,
  subtotal,
  requiresPrescription,
  points,
  shippingConfig = DEFAULT_SHIPPING_CONFIG,
}: {
  addresses: Address[];
  subtotal: number;
  requiresPrescription: boolean;
  points: number;
  shippingConfig?: ShippingConfig;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(placeOrder, undefined);

  // O banner de erro fica no topo do form; o toast garante que o aviso seja
  // visto mesmo com a página rolada até o botão (ex.: rate limit no duplo clique).
  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);
  const [addressId, setAddressId] = React.useState(addresses[0]?.id ?? "new");
  const [method, setMethod] = React.useState("pix");
  const [newZip, setNewZip] = React.useState("");
  const [cepLoading, setCepLoading] = React.useState(false);
  const isNew = addressId === "new";

  // Frete é calculado pelo CEP de destino (o servidor recalcula na confirmação).
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const currentZip = isNew ? newZip : selectedAddress?.zip ?? "";
  const shipping = shippingFor(subtotal, currentZip, shippingConfig);

  // Resgate de pontos (cálculo ao vivo; o servidor revalida o saldo na confirmação).
  const maxRedeem = maxRedeemablePoints(points, subtotal);
  const [usePoints, setUsePoints] = React.useState(false);
  const redeemPoints = usePoints ? maxRedeem : 0;
  const redeemDiscount = pointsToBRL(redeemPoints);
  const total = Math.max(0, subtotal - redeemDiscount) + shipping;

  async function handleCepBlur() {
    setCepLoading(true);
    const found = await lookupCep(newZip).finally(() => setCepLoading(false));
    if (!found || !formRef.current) return;
    const set = (name: string, value: string) => {
      const el = formRef.current!.elements.namedItem(name) as
        | HTMLInputElement
        | null;
      if (el && value) el.value = value;
    };
    set("street", found.street);
    set("district", found.district);
    set("city", found.city);
    set("state", found.state);
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {state?.error && (
          <div className="flex items-center gap-2 rounded-xl bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500">
            <AlertCircle className="size-4 shrink-0" /> {state.error}
          </div>
        )}

        {/* Endereço */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2.5 font-bold">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
              1
            </span>
            <MapPin className="size-5 text-brand-600 dark:text-brand-400" /> Endereço de entrega
          </h2>

          <div className="space-y-2">
            {addresses.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                  addressId === a.id
                    ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                    : "border-border hover:border-brand-300"
                )}
              >
                <input
                  type="radio"
                  name="addressId"
                  value={a.id}
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="mt-1 size-4 accent-brand-600"
                />
                <div className="text-sm">
                  <p className="font-semibold">
                    {a.label} · {a.recipient}
                  </p>
                  <p className="text-muted-foreground">
                    {a.street}, {a.number}
                    {a.complement ? ` - ${a.complement}` : ""} · {a.district},{" "}
                    {a.city}/{a.state} · {a.zip}
                  </p>
                </div>
              </label>
            ))}

            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                isNew
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                  : "border-border hover:border-brand-300"
              )}
            >
              <input
                type="radio"
                name="addressId"
                value="new"
                checked={isNew}
                onChange={() => setAddressId("new")}
                className="size-4 accent-brand-600"
              />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <Plus className="size-4" /> Usar um novo endereço
              </span>
            </label>
          </div>

          {isNew && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Destinatário" htmlFor="recipient">
                <Input id="recipient" name="recipient" placeholder="Nome de quem recebe" />
              </Field>
              <Field
                label="CEP"
                htmlFor="zip"
                hint={cepLoading ? "Buscando endereço…" : "Preenche o endereço automaticamente"}
              >
                <Input
                  id="zip"
                  name="zip"
                  placeholder="00000-000"
                  inputMode="numeric"
                  value={newZip}
                  onChange={(e) => setNewZip(e.target.value)}
                  onBlur={handleCepBlur}
                />
              </Field>
              <Field label="Rua" htmlFor="street">
                <Input id="street" name="street" placeholder="Av. Paulista" />
              </Field>
              <Field label="Número" htmlFor="number">
                <Input id="number" name="number" placeholder="1000" />
              </Field>
              <Field label="Complemento" htmlFor="complement">
                <Input id="complement" name="complement" placeholder="Apto 12 (opcional)" />
              </Field>
              <Field label="Bairro" htmlFor="district">
                <Input id="district" name="district" placeholder="Centro" />
              </Field>
              <Field label="Cidade" htmlFor="city">
                <Input id="city" name="city" placeholder="São Paulo" />
              </Field>
              <Field label="Estado (UF)" htmlFor="state">
                <Input id="state" name="state" placeholder="SP" maxLength={2} />
              </Field>
            </div>
          )}
        </section>

        {/* Pagamento */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2.5 font-bold">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
              2
            </span>
            Forma de pagamento
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {methods.map((m) => (
              <label
                key={m.id}
                className={cn(
                  "relative cursor-pointer rounded-xl border p-4 text-center transition active:scale-[0.98]",
                  method === m.id
                    ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/25 dark:bg-brand-600/10"
                    : "border-border hover:border-brand-300"
                )}
              >
                {method === m.id && (
                  <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="size-3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
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
                    method === m.id ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                  )}
                />
                <p className="mt-2 text-sm font-bold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </label>
            ))}
          </div>
        </section>

        {/* Observações */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <MessageSquareText className="size-5 text-brand-600 dark:text-brand-400" />{" "}
            Observações <span className="text-sm font-medium text-muted-foreground">(opcional)</span>
          </h2>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="Ex.: entregar na portaria, interfone 12, troco para R$ 100…"
            className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
          />
        </section>

        {/* Receita */}
        {requiresPrescription && (
          <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <h2 className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
              <FileText className="size-5" /> Receita médica
            </h2>
            <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
              Sua sacola tem itens que exigem receita. Envie o arquivo (foto ou
              PDF) para validação farmacêutica.
            </p>
            <input
              type="file"
              name="prescription"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              aria-required="true"
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Formatos aceitos: JPG, PNG, WEBP ou PDF (até 5 MB). O envio é
              obrigatório para finalizar o pedido.
            </p>
          </section>
        )}
      </div>

      {/* Resumo */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2.5 font-bold">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
              3
            </span>
            Revisão do pedido
          </h2>
          <Field label="Cupom de desconto" htmlFor="coupon">
            <Input id="coupon" name="coupon" placeholder="Ex.: BEMVINDO10" />
          </Field>

          {/* Resgate de pontos de fidelidade */}
          <input type="hidden" name="redeemPoints" value={redeemPoints} />
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
                  Abate {formatBRL(pointsToBRL(maxRedeem))} · você tem{" "}
                  {points.toLocaleString("pt-BR")} pts
                </span>
              </span>
            </label>
          )}

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-semibold">{formatBRL(subtotal)}</dd>
            </div>
            {redeemDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pontos de fidelidade</dt>
                <dd className="font-semibold text-success-600">
                  −{formatBRL(redeemDiscount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frete</dt>
              <dd className="font-semibold">
                {shipping === 0 ? <span className="text-success-600">Grátis</span> : formatBRL(shipping)}
              </dd>
            </div>
          </dl>
          <div className="flex items-end justify-between border-t border-border pt-4">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-extrabold text-brand-700 dark:text-brand-400">
              {formatBRL(total)}
            </span>
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
            Finalizar pedido
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ambiente seguro · cupom aplicado na confirmação
          </p>
        </div>
      </aside>
    </form>
  );
}
