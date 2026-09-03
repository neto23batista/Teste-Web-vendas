"use client";

import * as React from "react";
import { Check, Loader2, PackageCheck, RotateCcw, X } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { ReturnQuarantineItem } from "./return-quarantine-item";
import {
  decideReturnRequest,
  receiveReturnRequest,
  retryReturnRefund,
} from "@/client/api/admin";
import type {
  ReturnItemDisposition,
  ReturnReason,
  ReturnRefundStatus,
  ReturnStatus,
} from "@/contracts/domain";
import { formatBRL } from "@/lib/utils";

export type RequestRow = {
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
    receivedQty: number;
    restockQty: number;
    disposition: ReturnItemDisposition;
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
  RECEIVED: "Recebida fisicamente",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

const inputClass = "h-11 min-w-0 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm";

export function ReturnManagement({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 print:hidden">
      <div>
        <h2 className="font-bold">Pós-venda e devoluções</h2>
        <p className="text-xs text-muted-foreground">
          Recebimento, conferência sanitária e liquidação financeira são etapas
          separadas.
        </p>
      </div>
      {requests.map((request) => <ReturnRequestRow key={request.id} request={request} />)}
    </section>
  );
}

function ReturnRequestRow({ request }: { request: RequestRow }) {
  const { pending, confirm, dialog } = useConfirmAction();

  function decide(approve: boolean, form: HTMLFormElement) {
    if (approve && !form.reportValidity()) return;
    const data = new FormData(form);
    confirm({
      title: approve ? "Aprovar solicitação de devolução" : "Recusar solicitação de devolução",
      confirmLabel: approve ? "Confirmar aprovação" : "Confirmar recusa",
      destructive: !approve,
      confirmMessage: approve
        ? `Aprovar a devolução com valor de R$ ${data.get("approvedAmount")}? A aprovação autoriza o recebimento; estoque e liquidação financeira serão tratados nas etapas seguintes.`
        : "A solicitação será recusada. Nenhum item será recebido nem reembolsado por esta decisão. Registre um parecer que explique a análise.",
      reason: { label: "Parecer do atendimento", required: true, initialValue: String(data.get("adminNotes") ?? ""), maxLength: 1000 },
      action: (adminNotes) => decideReturnRequest({
        returnId: request.id,
        approve,
        approvedAmount: String(data.get("approvedAmount") ?? ""),
        adminNotes,
      }),
      successMessage: approve ? "Devolução aprovada. Aguarde o recebimento físico." : "Devolução recusada e parecer registrado.",
    });
  }

  function receive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const received = request.items.map((item) => ({ returnItemId: item.id, qty: Number(data.get(`received:${item.id}`) ?? 0) }));
    confirm({
      title: "Registrar recebimento físico da devolução",
      confirmLabel: "Confirmar recebimento",
      confirmMessage: `Confirmar ${received.reduce((total, item) => total + item.qty, 0)} unidade(s) recebida(s)? Os itens ficarão em quarentena até a conferência sanitária. A liquidação será iniciada e poderá continuar pendente após este recebimento.`,
      reason: { label: "Condição em que os itens chegaram", required: true, initialValue: request.adminNotes ?? "", maxLength: 1000 },
      action: (adminNotes) => receiveReturnRequest({
        returnId: request.id,
        adminNotes,
        received,
      }),
      successMessage: "Recebimento registrado. Confira a liquidação e a conferência sanitária abaixo.",
      warningMessage: "Recebimento físico confirmado. O reembolso está pendente de confirmação; os itens seguem em quarentena.",
    });
  }

  function retryRefund() {
    confirm({
      title: "Retomar liquidação da devolução",
      confirmLabel: "Consultar e retomar liquidação",
      confirmMessage: "O sistema verificará o reembolso existente antes de retomar a liquidação. O recebimento físico e a movimentação dos itens não serão repetidos.",
      action: () => retryReturnRefund(request.id),
      successMessage: "Liquidação financeira confirmada.",
      warningMessage: "Reembolso ainda pendente ou em processamento. Acompanhe a confirmação nesta devolução.",
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      {dialog}
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
          <li key={item.id}>
            {item.qty} × {item.orderItem.name}
            {item.disposition === "RESTOCKED" && ` · ${item.restockQty} de volta ao lote`}
            {item.disposition === "RESTOCKED" && item.receivedQty > item.restockQty && ` · ${item.receivedQty - item.restockQty} não liberada(s) para venda`}
            {item.disposition === "DISCARDED" && " · descartado"}
            {item.disposition === "PENDING" && item.receivedQty > 0 && (
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {" "}· {item.receivedQty} em quarentena
              </span>
            )}
          </li>
        ))}
      </ul>
      {request.customerNotes && <p className="rounded-lg bg-muted p-2 text-xs">Cliente: {request.customerNotes}</p>}
      {(request.status === "RECEIVED" || request.status === "COMPLETED") && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="font-semibold">
            Liquidação: {request.refundStatus === "SUCCEEDED" ? "reembolso concluído" : request.refundStatus === "PROCESSING" ? "aguardando confirmação do reembolso" : request.refundStatus === "FAILED" ? "reembolso pendente de acompanhamento" : "reembolso pendente"}
          </p>
          {request.refundError && <p className="text-foreground">Não foi possível confirmar a liquidação. O recebimento já registrado está preservado. Referência operacional: {request.id}.</p>}
          {(request.refundStatus === "FAILED" || request.refundStatus === "PENDING") && (
            <button type="button" onClick={retryRefund} disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 font-bold disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Tentar liquidação novamente
            </button>
          )}
        </div>
      )}

      {request.status === "REQUESTED" && (
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); decide(true, event.currentTarget); }}>
          <label className="grid gap-1 text-xs font-semibold">Valor aprovado (R$)<input className={inputClass} disabled={pending} name="approvedAmount" inputMode="decimal" defaultValue={request.requestedAmount.toFixed(2).replace(".", ",")} required /></label>
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

      {request.items.some(
        (item) => item.disposition === "PENDING" && item.receivedQty > 0,
      ) && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-bold">
            Conferência sanitária — {request.items.filter((i) => i.disposition === "PENDING" && i.receivedQty > 0).length} item(ns) em quarentena
          </p>
          <p className="text-xs text-muted-foreground">
            Liberar devolve as unidades ao lote de origem. Se o lote não for
            rastreável ou estiver vencido, só o descarte é possível.
          </p>
          {request.items
            .filter((item) => item.disposition === "PENDING" && item.receivedQty > 0)
            .map((item) => (
              <ReturnQuarantineItem key={item.id} item={item} />
            ))}
        </div>
      )}

      {request.status === "APPROVED" && (
        <form onSubmit={receive} className="grid gap-2">
          <p className="text-xs font-semibold">Quantidade que chegou fisicamente:</p>
          <p className="text-xs text-muted-foreground">
            Nada volta ao estoque agora. Os itens ficam em quarentena até a
            conferência liberar ou descartar cada um.
          </p>
          {request.items.map((item) => (
            <label key={item.id} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
              <span>{item.orderItem.name}</span>
              <input className={inputClass} disabled={pending} name={`received:${item.id}`} type="number" min={0} max={item.qty} defaultValue={item.qty} required />
            </label>
          ))}
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 text-xs font-bold text-white disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} Confirmar recebimento
          </button>
        </form>
      )}
    </div>
  );
}
