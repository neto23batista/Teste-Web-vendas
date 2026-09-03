"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export type DeliveryProofInput = {
  method: "RECIPIENT" | "CONCIERGE" | "SAFE_PLACE" | "PICKUP";
  recipientName: string;
  recipientDocumentLast4: string;
  notes: string;
};

/** Apresenta a coleta do comprovante; a operação é responsabilidade do adaptador. */
export function DeliveryProofForm({ orderId, pending, onConfirm }: {
  orderId: string;
  pending: boolean;
  onConfirm: (proof: DeliveryProofInput) => void;
}) {
  return (
    <details className="min-w-0 sm:min-w-[22rem]">
      <summary className="inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted">
        <CheckCircle2 aria-hidden="true" className="size-4 text-success-600" /> Confirmar com comprovante
      </summary>
      <form className="mt-2 grid gap-3 rounded-xl border border-border bg-background p-3 shadow-sm" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onConfirm({
          method: String(data.get("method")) as DeliveryProofInput["method"],
          recipientName: String(data.get("recipientName") ?? ""),
          recipientDocumentLast4: String(data.get("recipientDocumentLast4") ?? ""),
          notes: String(data.get("notes") ?? ""),
        });
      }}>
        <Field label="Forma de recebimento" htmlFor={`method-${orderId}`}>
          <select id={`method-${orderId}`} name="method" disabled={pending} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500" required>
            <option value="RECIPIENT">Recebido pelo destinatário</option>
            <option value="CONCIERGE">Recebido na portaria</option>
            <option value="SAFE_PLACE">Deixado em local autorizado</option>
            <option value="PICKUP">Retirado na unidade</option>
          </select>
        </Field>
        <Field label="Nome de quem recebeu" htmlFor={`recipient-${orderId}`}>
          <Input id={`recipient-${orderId}`} name="recipientName" maxLength={120} required disabled={pending} />
        </Field>
        <Field label="Últimos 4 dígitos do documento (opcional)" htmlFor={`document-${orderId}`}>
          <Input id={`document-${orderId}`} name="recipientDocumentLast4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" disabled={pending} />
        </Field>
        <Field label="Observação do comprovante (opcional)" htmlFor={`notes-${orderId}`}>
          <Input id={`notes-${orderId}`} name="notes" maxLength={1000} disabled={pending} />
        </Field>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
          Registrar entrega
        </Button>
      </form>
    </details>
  );
}
