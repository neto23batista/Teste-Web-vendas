"use client";

import * as React from "react";
import { useOperation } from "@/hooks/use-operation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cancelReturnRequest, requestReturn } from "@/client/api/account";
import type { ReturnReason, ReturnStatus } from "@/contracts/domain";

const STATUS: Record<ReturnStatus, string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  RECEIVED: "Itens recebidos",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

export function ReturnRequestControl({
  orderId,
  canRequest,
  items,
  latest,
}: {
  orderId: string;
  canRequest: boolean;
  items: { id: string; name: string; qty: number }[];
  latest?: { id: string; status: ReturnStatus };
}) {
  const router = useRouter();
  const { pending, run: startTransition } = useOperation();
  const active = latest && ["REQUESTED", "APPROVED", "RECEIVED"].includes(latest.status);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await requestReturn({
        orderId,
        reason: String(form.get("reason")) as ReturnReason,
        notes: String(form.get("notes") ?? ""),
        items: items.map((item) => ({
          orderItemId: item.id,
          qty: Number(form.get(`qty:${item.id}`) ?? 0),
        })),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao solicitar devolução.");
        router.refresh();
        return;
      }
      toast.success("Solicitação de devolução registrada.");
      router.refresh();
    });
  }

  function cancel() {
    if (!latest) return;
    startTransition(async () => {
      const result = await cancelReturnRequest(latest.id);
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao cancelar a solicitação.");
        router.refresh();
        return;
      }
      toast.success("Solicitação cancelada.");
      router.refresh();
    });
  }

  if (active) {
    return (
      <div className="flex flex-1 items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold">
        <span>Devolução: {STATUS[latest.status]}</span>
        {latest.status === "REQUESTED" && (
          <button type="button" onClick={cancel} disabled={pending} className="text-danger-500 disabled:opacity-50">
            Cancelar
          </button>
        )}
      </div>
    );
  }
  if (!canRequest) return null;

  return (
    <details className="flex-1">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:bg-muted">
        <RotateCcw className="size-3.5" /> Solicitar devolução
      </summary>
      <form onSubmit={submit} className="absolute inset-x-4 bottom-14 z-20 grid gap-2 rounded-xl border border-border bg-card p-4 shadow-xl">
        <p className="text-sm font-bold">Itens para devolver</p>
        {items.map((item) => (
          <label key={item.id} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
            <span className="truncate">{item.name} (máx. {item.qty})</span>
            <input name={`qty:${item.id}`} type="number" min={0} max={item.qty} defaultValue={0} className="h-9 rounded-lg border border-border bg-background px-2" />
          </label>
        ))}
        <select name="reason" required className="h-10 rounded-lg border border-border bg-background px-3 text-xs">
          <option value="WITHDRAWAL">Desisti da compra</option>
          <option value="DAMAGED">Produto avariado</option>
          <option value="WRONG_ITEM">Item incorreto</option>
          <option value="QUALITY">Problema de qualidade</option>
          <option value="OTHER">Outro motivo</option>
        </select>
        <textarea name="notes" rows={2} maxLength={1000} placeholder="Explique o ocorrido (opcional)" className="rounded-lg border border-border bg-background p-2 text-xs" />
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 text-xs font-bold text-white disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Enviar solicitação
        </button>
      </form>
    </details>
  );
}
