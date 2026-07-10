"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck, CheckCircle2, UserPlus, Power } from "lucide-react";
import { toast } from "sonner";
import {
  createCourier,
  toggleCourier,
  dispatchOrder,
  markDelivered,
} from "@/actions/admin-deliveries";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export type CourierRow = { id: string; name: string; phone: string | null; active: boolean; pharmacyName: string | null };
export type DeliveryOrder = {
  id: string;
  number: string;
  total: number;
  status: string;
  courierName: string | null;
  address: string | null;
  dispatchedAt: string | null;
};

export function DeliveryBoard({
  prontos,
  emRota,
  couriers,
  pharmacies,
}: {
  prontos: DeliveryOrder[];
  emRota: DeliveryOrder[];
  couriers: CourierRow[];
  pharmacies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const formRef = React.useRef<HTMLFormElement>(null);
  const ativos = couriers.filter((c) => c.active);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(sucesso);
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível concluir.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Prontos para sair */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Truck className="size-5 text-brand-600 dark:text-brand-400" /> Prontos para sair (
          {prontos.length})
        </h2>
        {prontos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum pedido pago aguardando entrega.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {prontos.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.number} · {formatBRL(o.total)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{o.address ?? "sem endereço"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={picked[o.id] ?? ""}
                    onChange={(e) => setPicked((p) => ({ ...p, [o.id]: e.target.value }))}
                    disabled={pending || ativos.length === 0}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
                  >
                    <option value="">Escolher entregador…</option>
                    {ativos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={pending || !picked[o.id]}
                    onClick={() => run(() => dispatchOrder(o.id, picked[o.id]), "Pedido saiu para entrega.")}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                    Despachar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {ativos.length === 0 && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Cadastre ao menos um entregador ativo para despachar pedidos.
          </p>
        )}
      </section>

      {/* Em rota */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold">Em rota ({emRota.length})</h2>
        {emRota.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrega em rota.</p>
        ) : (
          <div className="divide-y divide-border">
            {emRota.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.number} · {formatBRL(o.total)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.courierName ?? "sem entregador"}
                    {o.dispatchedAt ? ` · saiu ${o.dispatchedAt}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => markDelivered(o.id), "Entrega confirmada.")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-success-600" />}
                  Confirmar entrega
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Entregadores */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <UserPlus className="size-5 text-brand-600 dark:text-brand-400" /> Entregadores
        </h2>
        <form
          ref={formRef}
          action={(fd) =>
            start(async () => {
              const res = await createCourier(fd);
              if (res.ok) {
                toast.success("Entregador cadastrado.");
                formRef.current?.reset();
                router.refresh();
              } else {
                toast.error(res.error ?? "Falha ao cadastrar.");
              }
            })
          }
          className="grid gap-3 sm:grid-cols-4"
        >
          <Field label="Nome" htmlFor="name">
            <Input id="name" name="name" placeholder="João Motoboy" required />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <Input id="phone" name="phone" placeholder="(11) 90000-0000" inputMode="tel" />
          </Field>
          <Field label="Unidade" htmlFor="pharmacyId">
            <select
              id="pharmacyId"
              name="pharmacyId"
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
            >
              <option value="">— todas —</option>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="primary" className="w-full" disabled={pending}>
              Cadastrar
            </Button>
          </div>
        </form>

        <div className="divide-y divide-border">
          {couriers.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      inativo
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.phone ?? "sem telefone"}
                  {c.pharmacyName ? ` · ${c.pharmacyName}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => toggleCourier(c.id), c.active ? "Entregador desativado." : "Entregador ativado.")}
              >
                <Power className="size-4" /> {c.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
          {couriers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum entregador cadastrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
