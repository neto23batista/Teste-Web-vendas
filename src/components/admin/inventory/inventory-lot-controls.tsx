"use client";

import * as React from "react";
import { Loader2, PackagePlus, Trash2 } from "lucide-react";
import { receiveInventoryLot, writeOffInventoryLot } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm";

export function LotReceipt({
  productId,
  pharmacyId,
  suggested,
}: {
  productId: string;
  pharmacyId: string;
  suggested: number;
}) {
  const { pending, confirm, dialog } = useConfirmAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    confirm({
      title: "Confirmar recebimento do lote",
      confirmLabel: "Receber lote",
      confirmMessage: `Registrar ${form.get("qty")} unidade(s) do lote ${form.get("lotCode")}, com validade ${form.get("expiresOn")}? Confira quantidade, lote e validade na embalagem. O recebimento aumenta o saldo disponível e fica registrado no histórico.`,
      action: () => receiveInventoryLot({
        productId,
        pharmacyId,
        lotCode: String(form.get("lotCode") ?? ""),
        expiresOn: String(form.get("expiresOn") ?? ""),
        qty: Number(form.get("qty")),
        supplier: String(form.get("supplier") ?? ""),
        note: String(form.get("note") ?? ""),
      }),
      successMessage: "Lote recebido e estoque atualizado.",
      onSuccess: () => formElement.reset(),
    });
  }

  return (
    <>{dialog}<details className="min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-brand-600 dark:text-brand-400">
        <PackagePlus className="size-4" /> Receber lote
      </summary>
      <form onSubmit={submit} className="mt-2 grid w-full gap-2 rounded-xl border border-border bg-background p-3 shadow-sm sm:min-w-[20rem]">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-semibold">Lote<input className={inputClass} disabled={pending} name="lotCode" maxLength={120} required /></label>
          <label className="space-y-1 text-xs font-semibold">Validade<input className={inputClass} disabled={pending} name="expiresOn" type="date" required /></label>
          <label className="space-y-1 text-xs font-semibold">Quantidade<input className={inputClass} disabled={pending} name="qty" type="number" min={1} max={100000} defaultValue={Math.max(1, suggested)} required /></label>
          <label className="space-y-1 text-xs font-semibold">Fornecedor<input className={inputClass} disabled={pending} name="supplier" maxLength={160} /></label>
        </div>
        <label className="space-y-1 text-xs font-semibold">Observação (opcional)<input className={inputClass} disabled={pending} name="note" maxLength={500} /></label>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-bold text-white disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
          Confirmar recebimento
        </button>
      </form>
    </details></>
  );
}

export function LotWriteOff({
  lotId,
  pharmacyId,
  available,
}: {
  lotId: string;
  pharmacyId: string;
  available: number;
}) {
  const { pending, confirm, dialog } = useConfirmAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    confirm({
      title: "Registrar baixa do lote",
      confirmLabel: "Confirmar baixa",
      destructive: true,
      confirmMessage: `Retirar ${form.get("qty")} unidade(s) deste lote? A baixa reduz o saldo para venda e fica no histórico. Motivo informado: ${form.get("reason")}.`,
      action: () => writeOffInventoryLot({
        lotId,
        pharmacyId,
        qty: Number(form.get("qty")),
        reason: String(form.get("reason") ?? ""),
      }),
      successMessage: "Baixa registrada no lote e no estoque.",
    });
  }

  return (
    <>{dialog}<details>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-danger-500">
        <Trash2 className="size-3.5" /> Registrar baixa
      </summary>
      <form onSubmit={submit} className="mt-2 grid w-full gap-2 rounded-xl border border-border bg-background p-3 shadow-sm sm:min-w-[16rem]">
        <label className="space-y-1 text-xs font-semibold">Quantidade<input className={inputClass} disabled={pending} name="qty" type="number" min={1} max={available} defaultValue={available} required /></label>
        <label className="space-y-1 text-xs font-semibold">Motivo da baixa<input className={inputClass} disabled={pending} name="reason" placeholder="Avaria, vencimento…" maxLength={300} required /></label>
        <button type="submit" disabled={pending || available <= 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-danger-500/30 text-sm font-bold text-danger-500 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Confirmar baixa
        </button>
      </form>
    </details></>
  );
}
