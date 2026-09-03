"use client";

import * as React from "react";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { decideReturnItemDisposition } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import type { RequestRow } from "./return-management";

/** A conferência decide o destino físico; não repete a liquidação financeira. */
export function ReturnQuarantineItem({ item }: { item: RequestRow["items"][number] }) {
  const { pending, confirm, dialog } = useConfirmAction();

  function decide(decision: "RESTOCK" | "DISCARD", form: HTMLFormElement) {
    if (decision === "RESTOCK" && !form.reportValidity()) return;
    const data = new FormData(form);
    const qty = decision === "DISCARD" ? item.receivedQty : Number(data.get("qty") ?? 0);
    confirm({
      title: decision === "RESTOCK" ? "Liberar item da quarentena" : "Registrar descarte do item",
      confirmLabel: decision === "RESTOCK" ? "Liberar ao lote de origem" : "Confirmar descarte",
      destructive: decision === "DISCARD",
      confirmMessage: `${qty} unidade(s) de ${item.orderItem.name}. ${decision === "RESTOCK"
        ? `Confirme que a conferência sanitária foi concluída e que os itens podem voltar à venda. O servidor verificará a rastreabilidade e a validade do lote de origem.${qty < item.receivedQty ? ` As ${item.receivedQty - qty} unidade(s) restantes não serão liberadas para venda. A decisão encerra a conferência deste item.` : ""}`
        : "Os itens não voltarão ao saldo para venda. Esta decisão registra o descarte e encerra a conferência deste item."} O parecer ficará registrado no histórico.`,
      reason: { label: "Parecer da conferência", required: true, maxLength: 1000 },
      action: (notes) => decideReturnItemDisposition({ returnItemId: item.id, decision, qty, notes }),
      successMessage: decision === "RESTOCK" ? "Item liberado e devolvido ao lote de origem." : "Descarte registrado.",
    });
  }

  return (
    <>{dialog}<form className="grid gap-3 rounded-lg border border-border bg-card p-3 text-sm" onSubmit={(event) => {
      event.preventDefault();
      decide("RESTOCK", event.currentTarget);
    }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{item.orderItem.name}</span>
        <span className="text-xs text-muted-foreground">{item.receivedQty} un recebida(s)</span>
      </div>
      <label className="grid grid-cols-[1fr_5rem] items-center gap-2">
        <span>Quantidade a liberar</span>
        <input className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          name="qty" type="number" min={1} max={item.receivedQty} defaultValue={item.receivedQty} required disabled={pending} />
      </label>
      <p className="text-xs text-muted-foreground">A liberação encerra a conferência; o restante fica fora do saldo vendável. Ao descartar, todas as {item.receivedQty} unidade(s) recebidas serão descartadas.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={pending} onClick={(event) => decide("DISCARD", event.currentTarget.form!)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-danger-500/30 px-3 font-bold text-danger-500 disabled:opacity-60">
          <Trash2 aria-hidden="true" className="size-4" /> Descartar
        </button>
        <button type="submit" disabled={pending || !item.orderItem.productId}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 font-bold text-white disabled:opacity-60">
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
          Liberar ao lote
        </button>
      </div>
    </form></>
  );
}
