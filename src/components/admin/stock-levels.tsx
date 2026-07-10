"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { setStockLevels } from "@/actions/admin-purchasing";

/** Editor inline dos níveis de reposição (mín/máx) de um item de estoque. */
export function StockLevels({
  inventoryId,
  minStock,
  maxStock,
}: {
  inventoryId: string;
  minStock: number;
  maxStock: number | null;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [min, setMin] = React.useState(String(minStock));
  const [max, setMax] = React.useState(maxStock === null ? "" : String(maxStock));

  const dirty = min !== String(minStock) || max !== (maxStock === null ? "" : String(maxStock));

  function save() {
    const minVal = Number(min);
    const maxVal = max.trim() === "" ? null : Number(max);
    start(async () => {
      const res = await setStockLevels(inventoryId, minVal, maxVal);
      if (res.ok) {
        toast.success("Níveis atualizados.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  const box =
    "h-9 w-16 rounded-lg border border-border bg-card px-2 text-center text-sm font-semibold tabular-nums outline-none focus:border-brand-400";

  return (
    <div className="flex items-center gap-1.5">
      <input
        aria-label="Estoque mínimo"
        inputMode="numeric"
        value={min}
        onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
        disabled={pending}
        className={box}
      />
      <span className="text-xs text-muted-foreground">/</span>
      <input
        aria-label="Estoque máximo"
        inputMode="numeric"
        placeholder="—"
        value={max}
        onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
        disabled={pending}
        className={box}
      />
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label="Salvar níveis"
          className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
      )}
    </div>
  );
}
