"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2 } from "lucide-react";
import { adjustStock } from "@/actions/admin-products";

export function StockAdjust({
  id,
  pharmacyId,
  stock,
}: {
  id: string;
  pharmacyId: string;
  stock: number;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const change = (delta: number) =>
    start(async () => {
      await adjustStock(id, pharmacyId, delta);
      router.refresh();
    });

  return (
    <div className="inline-flex items-center rounded-xl border border-border">
      <button
        onClick={() => change(-1)}
        disabled={pending || stock <= 0}
        aria-label="Remover 1"
        className="grid size-9 place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <span className="grid w-12 place-items-center text-sm font-bold">
        {pending ? <Loader2 className="size-4 animate-spin" /> : stock}
      </span>
      <button
        onClick={() => change(1)}
        disabled={pending}
        aria-label="Adicionar 1"
        className="grid size-9 place-items-center text-muted-foreground transition hover:bg-muted"
      >
        <Plus className="size-4" />
      </button>
      <button
        onClick={() => change(10)}
        disabled={pending}
        className="rounded-r-xl border-l border-border px-2.5 text-xs font-bold text-brand-600 transition hover:bg-muted dark:text-brand-400"
      >
        +10
      </button>
    </div>
  );
}
