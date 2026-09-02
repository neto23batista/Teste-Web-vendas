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
  const [activeOperation, setActiveOperation] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const formRef = React.useRef<HTMLFormElement>(null);
  const ativos = couriers.filter((c) => c.active);

  function run(
    operation: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    sucesso: string
  ) {
    setActiveOperation(operation);
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          toast.success(sucesso);
          router.refresh();
        } else {
          toast.error(res.error ?? "Não foi possível concluir.");
        }
      } catch {
        toast.error("Não foi possível concluir. Tente novamente.");
      } finally {
        setActiveOperation(null);
      }
    });
  }

  return (
    <div className="space-y-6" aria-busy={pending}>
      {/* Prontos para sair */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
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
              <div
                key={o.id}
                className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)] md:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.number} · {formatBRL(o.total)}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {o.address ?? "sem endereço"}
                  </p>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label htmlFor={`courier-${o.id}`} className="sr-only">
                    Entregador do pedido {o.number}
                  </label>
                  <select
                    id={`courier-${o.id}`}
                    value={picked[o.id] ?? ""}
                    onChange={(e) => setPicked((p) => ({ ...p, [o.id]: e.target.value }))}
                    disabled={pending || ativos.length === 0}
                    className="h-11 min-w-0 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
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
                    className="h-11 w-full sm:w-auto"
                    disabled={pending || !picked[o.id]}
                    onClick={() =>
                      run(
                        `dispatch:${o.id}`,
                        () => dispatchOrder(o.id, picked[o.id]),
                        "Pedido saiu para entrega."
                      )
                    }
                  >
                    {activeOperation === `dispatch:${o.id}` ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Truck className="size-4" aria-hidden="true" />
                    )}
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
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-bold">Em rota ({emRota.length})</h2>
        {emRota.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrega em rota.</p>
        ) : (
          <div className="divide-y divide-border">
            {emRota.map((o) => (
              <div
                key={o.id}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.number} · {formatBRL(o.total)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.courierName ?? "sem entregador"}
                    {o.dispatchedAt ? ` · saiu ${o.dispatchedAt}` : ""}
                  </p>
                </div>
                <details className="sm:min-w-[22rem]">
                  <summary className="inline-flex h-11 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted">
                    <CheckCircle2 className="size-4 text-success-600" aria-hidden="true" />
                    Confirmar com comprovante
                  </summary>
                  <form
                    className="mt-2 grid gap-2 rounded-xl border border-border bg-background p-3 shadow-sm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      run(
                        `deliver:${o.id}`,
                        () =>
                          markDelivered(o.id, {
                            method: String(data.get("method")) as "RECIPIENT" | "CONCIERGE" | "SAFE_PLACE" | "PICKUP",
                            recipientName: String(data.get("recipientName") ?? ""),
                            recipientDocumentLast4: String(data.get("recipientDocumentLast4") ?? ""),
                            notes: String(data.get("notes") ?? ""),
                          }),
                        "Entrega confirmada com comprovante."
                      );
                    }}
                  >
                    <select name="method" className="h-10 rounded-lg border border-border bg-card px-3 text-sm" required>
                      <option value="RECIPIENT">Recebido pelo destinatário</option>
                      <option value="CONCIERGE">Recebido na portaria</option>
                      <option value="SAFE_PLACE">Deixado em local autorizado</option>
                      <option value="PICKUP">Retirado na unidade</option>
                    </select>
                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                      <Input name="recipientName" placeholder="Nome de quem recebeu" required />
                      <Input name="recipientDocumentLast4" inputMode="numeric" maxLength={4} placeholder="Doc. final" />
                    </div>
                    <Input name="notes" maxLength={1000} placeholder="Observação do comprovante" />
                    <Button type="submit" variant="primary" size="sm" className="h-10" disabled={pending}>
                      {activeOperation === `deliver:${o.id}` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      )}
                      Registrar entrega
                    </Button>
                  </form>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Entregadores */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <UserPlus className="size-5 text-brand-600 dark:text-brand-400" /> Entregadores
        </h2>
        <form
          ref={formRef}
          action={(fd) => {
            setActiveOperation("create-courier");
            start(async () => {
              try {
                const res = await createCourier(fd);
                if (res.ok) {
                  toast.success("Entregador cadastrado.");
                  formRef.current?.reset();
                  router.refresh();
                } else {
                  toast.error(res.error ?? "Falha ao cadastrar.");
                }
              } catch {
                toast.error("Falha ao cadastrar. Tente novamente.");
              } finally {
                setActiveOperation(null);
              }
            });
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
              {activeOperation === "create-courier" && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Cadastrar
            </Button>
          </div>
        </form>

        <div className="divide-y divide-border">
          {couriers.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
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
                className="h-11 w-full sm:w-auto"
                disabled={pending}
                onClick={() =>
                  run(
                    `courier:${c.id}`,
                    () => toggleCourier(c.id),
                    c.active ? "Entregador desativado." : "Entregador ativado."
                  )
                }
              >
                {activeOperation === `courier:${c.id}` ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Power className="size-4" aria-hidden="true" />
                )}
                {c.active ? "Desativar" : "Ativar"}
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
