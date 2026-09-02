"use client";

import * as React from "react";
import { Loader2, PackagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { receiveInventoryLot, writeOffInventoryLot } from "@/actions/admin/inventory-lots";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand-500";

export function LotReceipt({
  productId,
  pharmacyId,
  suggested,
}: {
  productId: string;
  pharmacyId: string;
  suggested: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await receiveInventoryLot({
        productId,
        pharmacyId,
        lotCode: String(form.get("lotCode") ?? ""),
        expiresOn: String(form.get("expiresOn") ?? ""),
        qty: Number(form.get("qty")),
        supplier: String(form.get("supplier") ?? ""),
        note: String(form.get("note") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao receber o lote.");
        return;
      }
      toast.success("Lote recebido e estoque atualizado.");
      formElement.reset();
      router.refresh();
    });
  }

  return (
    <details className="min-w-[12rem]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400">
        <PackagePlus className="size-4" /> Receber lote
      </summary>
      <form onSubmit={submit} className="mt-2 grid min-w-[20rem] gap-2 rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} name="lotCode" placeholder="Lote" maxLength={120} required />
          <input className={inputClass} name="expiresOn" type="date" required />
          <input className={inputClass} name="qty" type="number" min={1} max={100000} defaultValue={Math.max(1, suggested)} required />
          <input className={inputClass} name="supplier" placeholder="Fornecedor" maxLength={160} />
        </div>
        <input className={inputClass} name="note" placeholder="Nota/observação opcional" maxLength={500} />
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-xs font-bold text-white disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
          Confirmar recebimento
        </button>
      </form>
    </details>
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
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await writeOffInventoryLot({
        lotId,
        pharmacyId,
        qty: Number(form.get("qty")),
        reason: String(form.get("reason") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao baixar o lote.");
        return;
      }
      toast.success("Baixa registrada no lote e no estoque.");
      router.refresh();
    });
  }

  return (
    <details>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-danger-500">
        <Trash2 className="size-3.5" /> Registrar baixa
      </summary>
      <form onSubmit={submit} className="mt-2 grid min-w-[16rem] gap-2 rounded-xl border border-border bg-background p-3 shadow-sm">
        <input className={inputClass} name="qty" type="number" min={1} max={available} defaultValue={available} required />
        <input className={inputClass} name="reason" placeholder="Motivo: avaria, vencimento..." maxLength={300} required />
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-danger-500/30 text-xs font-bold text-danger-500 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Confirmar baixa
        </button>
      </form>
    </details>
  );
}
