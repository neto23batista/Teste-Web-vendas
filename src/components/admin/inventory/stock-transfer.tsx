"use client";

import * as React from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { transferStock } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

/**
 * Transfere estoque de um produto da unidade exibida para outra unidade.
 * Só aparece para a matriz. O número entre parênteses é o estoque atual da
 * unidade de destino (ajuda a decidir para onde mandar).
 */
export function StockTransfer({
  productId,
  fromUnitId,
  units,
  perUnit,
}: {
  productId: string;
  fromUnitId: string;
  units: { id: string; name: string }[];
  perUnit: Record<string, number>;
}) {
  const { pending, confirm, dialog } = useConfirmAction();
  const targets = units.filter((u) => u.id !== fromUnitId);
  const [to, setTo] = React.useState(targets[0]?.id ?? "");
  const [qty, setQty] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  if (targets.length === 0) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!to || !Number.isInteger(n) || n <= 0) {
      setErr("Informe uma quantidade válida.");
      return;
    }
    setErr(null);
    confirm({
      title: "Transferir estoque entre unidades",
      confirmLabel: "Confirmar transferência",
      confirmMessage: `Mover ${n} unidade(s) de ${units.find((unit) => unit.id === fromUnitId)?.name ?? "origem"} para ${targets.find((unit) => unit.id === to)?.name ?? "destino"}? O saldo e os lotes elegíveis serão conferidos pelo servidor e a movimentação ficará no histórico.`,
      action: () => transferStock(productId, fromUnitId, to, n),
      successMessage: "Transferência registrada e saldos atualizados.",
      onSuccess: () => setQty(""),
    });
  }

  return (
    <>{dialog}<form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <ArrowLeftRight className="size-3.5 text-muted-foreground" />
      <select
        value={to}
        disabled={pending}
        onChange={(e) => setTo(e.target.value)}
        aria-label="Unidade de destino"
        className="h-11 max-w-[10rem] rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {targets.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({perUnit[u.id] ?? 0})
          </option>
        ))}
      </select>
      <input
        inputMode="numeric"
        type="number"
        min={1}
        step={1}
        required
        disabled={pending}
        placeholder="qtd"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label="Quantidade a transferir"
        className="h-11 w-20 rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Enviar"}
      </button>
      {err && <span role="alert" className="w-full text-xs text-danger-500">{err}</span>}
    </form></>
  );
}
