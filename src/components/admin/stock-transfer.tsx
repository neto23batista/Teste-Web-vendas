"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { transferStock } from "@/actions/admin-products";

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
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const targets = units.filter((u) => u.id !== fromUnitId);
  const [to, setTo] = React.useState(targets[0]?.id ?? "");
  const [qty, setQty] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  if (targets.length === 0) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(qty));
    if (!to || !Number.isFinite(n) || n <= 0) {
      setErr("Informe uma quantidade válida.");
      return;
    }
    setErr(null);
    start(async () => {
      const res = await transferStock(productId, fromUnitId, to, n);
      if (!res.ok) {
        setErr(res.error ?? "Falha ao transferir.");
        return;
      }
      setQty("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
      <ArrowLeftRight className="size-3.5 text-muted-foreground" />
      <select
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="Unidade de destino"
        className="h-8 max-w-[10rem] rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-brand-400"
      >
        {targets.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({perUnit[u.id] ?? 0})
          </option>
        ))}
      </select>
      <input
        inputMode="numeric"
        placeholder="qtd"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label="Quantidade a transferir"
        className="h-8 w-14 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-brand-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Enviar"}
      </button>
      {err && <span className="w-full text-xs text-danger-500">{err}</span>}
    </form>
  );
}
