"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRightLeft, Loader2 } from "lucide-react";
import { transferOrderToUnit } from "@/actions/admin-orders";

/**
 * Reatribui um pedido a outra unidade (move o estoque entre elas). Aparece só
 * em pedidos ainda tratáveis pela unidade (PENDING/PAID/PREPARING).
 */
export function OrderTransfer({
  orderId,
  currentUnitName,
  targetUnits,
}: {
  orderId: string;
  currentUnitName: string;
  targetUnits: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState(targetUnits[0]?.id ?? "");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    if (!target) return;
    const name = targetUnits.find((u) => u.id === target)?.name ?? "outra unidade";
    if (
      !confirm(
        `Transferir este pedido para ${name}? O estoque será movido entre as unidades.`
      )
    )
      return;
    setError(null);
    start(async () => {
      const res = await transferOrderToUnit(orderId, target);
      if (!res.ok) {
        setError(res.error ?? "Falha ao transferir o pedido.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
      <p className="flex items-center gap-2 font-bold">
        <Building2 className="size-4 text-brand-600 dark:text-brand-400" /> Unidade
      </p>
      <p className="text-sm text-muted-foreground">
        Atual: <strong className="text-foreground">{currentUnitName}</strong>
      </p>

      {targetUnits.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Não há outra unidade ativa para transferir.
        </p>
      ) : (
        <>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Unidade de destino"
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
          >
            {targetUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !target}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold transition hover:border-brand-300 hover:bg-muted disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="size-4" />
            )}
            Transferir para esta unidade
          </button>
          {error && <p className="text-sm font-medium text-danger-500">{error}</p>}
        </>
      )}
    </div>
  );
}
