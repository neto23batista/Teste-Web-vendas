"use client";

import * as React from "react";
import { Check, Loader2, PackageCheck, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  decideReturnRequest,
  receiveReturnRequest,
  retryReturnRefund,
} from "@/actions/account/returns";
import type { ReturnReason, ReturnRefundStatus, ReturnStatus } from "@prisma/client";
import { formatBRL } from "@/lib/utils";

type RequestRow = {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  customerNotes: string | null;
  adminNotes: string | null;
  requestedAmount: number;
  approvedAmount: number | null;
  refundStatus: ReturnRefundStatus;
  refundError: string | null;
  requestedAt: Date | string;
  items: {
    id: string;
    qty: number;
    restockQty: number;
    orderItem: { name: string; productId: string | null };
  }[];
};

const REASON: Record<ReturnReason, string> = {
  WITHDRAWAL: "Desistência",
  DAMAGED: "Produto avariado",
  WRONG_ITEM: "Item incorreto",
  QUALITY: "Problema de qualidade",
  OTHER: "Outro",
};

const STATUS: Record<ReturnStatus, string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  RECEIVED: "Recebida; liquidação pendente",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

const inputClass = "h-10 rounded-lg border border-border bg-background px-3 text-sm";

export function ReturnManagement({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
      <div>
        <h2 className="font-bold">Pós-venda e devoluções</h2>
        <p className="text-xs text-muted-foreground">
          A reposição física é separada da liquidação financeira.
        </p>
      </div>
      {requests.map((request) => <ReturnRequestRow key={request.id} request={request} />)}
    </section>
  );
}

function ReturnRequestRow({ request }: { request: RequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function decide(approve: boolean, form: HTMLFormElement) {
    const data = new FormData(form);
    startTransition(async () => {
      const result = await decideReturnRequest({
        returnId: request.id,
        approve,
        approvedAmount: String(data.get("approvedAmount") ?? ""),
        adminNotes: String(data.get("adminNotes") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao analisar a devolução.");
        return;
      }
      toast.success(approve ? "Devolução aprovada." : "Devolução recusada.");
      router.refresh();
    });
  }

  function receive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await receiveReturnRequest({
        returnId: request.id,
        adminNotes: String(data.get("adminNotes") ?? ""),
        restock: request.items.map((item) => ({
          returnItemId: item.id,
          qty: Number(data.get(`restock:${item.id}`) ?? 0),
        })),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao receber a devolução.");
        return;
      }
      toast.success("Itens recebidos e estoque reaproveitável reposto.");
      if (result.warning) toast.warning(result.warning);
      router.refresh();
    });
  }

  function retryRefund() {
    startTransition(async () => {
      const result = await retryReturnRefund(request.id);
      if (!result.ok) {
        toast.error(result.error ?? "Falha ao liquidar a devolução.");
        return;
      }
      if (result.warning) toast.warning(result.warning);
      else toast.success("Devolução liquidada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{REASON[request.reason]} · {formatBRL(request.requestedAmount)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.requestedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{STATUS[request.status]}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {request.items.map((item) => (
          <li key={item.id}>{item.qty} × {item.orderItem.name}{item.restockQty > 0 ? ` · ${item.restockQty} reposto(s)` : ""}</li>
        ))}
      </ul>
      {request.customerNotes && <p className="rounded-lg bg-muted p-2 text-xs">Cliente: {request.customerNotes}</p>}
      {request.status === "RECEIVED" && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="font-semibold">
            Liquidação: {request.refundStatus === "PROCESSING" ? "em processamento" : request.refundStatus === "FAILED" ? "falhou" : "pendente"}
          </p>
          {request.refundError && <p className="text-danger-500">{request.refundError}</p>}
          {(request.refundStatus === "FAILED" || request.refundStatus === "PENDING") && (
            <button type="button" onClick={retryRefund} disabled={pending} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 font-bold disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Tentar liquidação novamente
            </button>
          )}
        </div>
      )}

      {request.status === "REQUESTED" && (
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); decide(true, event.currentTarget); }}>
          <input className={inputClass} name="approvedAmount" inputMode="decimal" defaultValue={request.requestedAmount.toFixed(2).replace(".", ",")} aria-label="Valor aprovado" />
          <textarea name="adminNotes" rows={2} maxLength={1000} placeholder="Parecer do atendimento" className="rounded-lg border border-border bg-background p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={(event) => decide(false, event.currentTarget.form!)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger-500/30 text-xs font-bold text-danger-500 disabled:opacity-60">
              <X className="size-4" /> Recusar
            </button>
            <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 text-xs font-bold text-white disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Aprovar
            </button>
          </div>
        </form>
      )}

      {request.status === "APPROVED" && (
        <form onSubmit={receive} className="grid gap-2">
          <p className="text-xs font-semibold">Quantidade em condição de voltar ao estoque:</p>
          {request.items.map((item) => (
            <label key={item.id} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
              <span>{item.orderItem.name}</span>
              <input className={inputClass} name={`restock:${item.id}`} type="number" min={0} max={item.qty} defaultValue={0} disabled={!item.orderItem.productId} />
            </label>
          ))}
          <textarea name="adminNotes" rows={2} maxLength={1000} defaultValue={request.adminNotes ?? ""} placeholder="Condição dos itens recebidos" className="rounded-lg border border-border bg-background p-2 text-sm" />
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 text-xs font-bold text-white disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} Confirmar recebimento
          </button>
        </form>
      )}
    </div>
  );
}
