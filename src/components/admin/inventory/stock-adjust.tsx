"use client";

import { Minus, Plus, Loader2 } from "lucide-react";
import { adjustStock } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function StockAdjust({
  id,
  pharmacyId,
  stock,
}: {
  id: string;
  pharmacyId: string;
  stock: number;
}) {
  const { pending, confirm, dialog } = useConfirmAction();

  const change = (delta: number) =>
    confirm({
      title: delta > 0 ? "Registrar entrada manual" : "Registrar retirada manual",
      confirmLabel: "Confirmar ajuste de estoque",
      destructive: delta < 0,
      confirmMessage: `O saldo exibido é ${stock} unidade(s). Este ajuste ${delta > 0 ? "adiciona" : "retira"} ${Math.abs(delta)} unidade(s) e fica registrado no livro de movimentações. Confira o saldo físico antes de continuar. Para produto rastreado por lote, utilize o recebimento ou a baixa do lote.`,
      reason: { label: "Motivo do ajuste", required: true, maxLength: 500 },
      action: (reason) => adjustStock(id, pharmacyId, delta, reason),
      successMessage: "Ajuste confirmado e registrado no histórico de estoque.",
    });

  return (
    <div className="inline-flex items-center rounded-xl border border-border">
      {dialog}
      <button
        onClick={() => change(-1)}
        disabled={pending || stock <= 0}
        aria-label="Remover 1"
        className="grid size-11 place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
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
        className="grid size-11 place-items-center text-muted-foreground transition hover:bg-muted"
      >
        <Plus className="size-4" />
      </button>
      <button
        onClick={() => change(10)}
        disabled={pending}
        className="min-h-11 rounded-r-xl border-l border-border px-2.5 text-xs font-bold text-brand-600 transition hover:bg-muted dark:text-brand-400"
      >
        +10
      </button>
    </div>
  );
}
