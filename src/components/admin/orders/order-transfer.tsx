"use client";

import * as React from "react";
import { Building2, ArrowRightLeft, Loader2 } from "lucide-react";
import { transferOrderToUnit } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

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
  const [target, setTarget] = React.useState(targetUnits[0]?.id ?? "");
  const { pending, confirm, dialog } = useConfirmAction();

  function submit() {
    if (!target) return;
    const name = targetUnits.find((u) => u.id === target)?.name ?? "outra unidade";
    confirm({
      title: "Transferir pedido entre unidades",
      confirmLabel: "Confirmar transferência",
      confirmMessage: `O pedido sairá de ${currentUnitName} e ficará sob responsabilidade de ${name}. O estoque será movimentado entre as unidades. Se outro operador já tiver despachado o pedido, atualize os dados para conferir a situação.`,
      action: () => transferOrderToUnit(orderId, target),
      successMessage: "Pedido transferido e estoque atualizado.",
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
      {dialog}
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
            disabled={pending}
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
        </>
      )}
    </div>
  );
}
