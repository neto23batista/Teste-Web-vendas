"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmationReason = {
  label: string;
  required?: boolean;
  initialValue?: string;
  maxLength?: number;
};

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  reason?: ConfirmationReason;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  onRefresh: () => void;
  onRestoreFocus?: () => void;
};

/** A mesma confirmação atende mouse, toque, teclado e leitores de tela. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const reasonId = React.useId();
  const statusId = React.useId();

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => { if (!open && !props.pending) props.onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[91] max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); props.onRestoreFocus?.(); }}
          onEscapeKeyDown={(event) => { if (props.pending) event.preventDefault(); }}
          onPointerDownOutside={(event) => event.preventDefault()}
          aria-busy={props.pending}
        >
          <Dialog.Title className="text-lg font-bold">{props.title}</Dialog.Title>
          <Dialog.Description className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {props.description}
          </Dialog.Description>
          <form className="mt-5 space-y-4" onSubmit={(event) => {
            event.preventDefault();
            props.onConfirm(String(new FormData(event.currentTarget).get("reason") ?? "").trim());
          }}>
            {props.reason && (
              <div className="space-y-1.5">
                <label htmlFor={reasonId} className="text-sm font-semibold">
                  {props.reason.label}{props.reason.required ? " (obrigatório)" : " (opcional)"}
                </label>
                <textarea id={reasonId} name="reason" rows={3} required={props.reason.required}
                  maxLength={props.reason.maxLength ?? 500} defaultValue={props.reason.initialValue ?? ""}
                  disabled={props.pending} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm" />
              </div>
            )}
            <div id={statusId} aria-live="polite" aria-atomic="true">
              {props.pending && <p role="status" className="text-sm text-muted-foreground">Aguardando confirmação do servidor…</p>}
              {props.error && (
                <div role="alert" className="space-y-2 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm">
                  <p className="font-medium text-foreground">{props.error}</p>
                  <p className="text-muted-foreground">Confira o estado atualizado antes de repetir a operação.</p>
                  <Button variant="outline" onClick={props.onRefresh} disabled={props.pending}>
                    <RefreshCw aria-hidden="true" className="size-4" /> Atualizar dados
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button ref={cancelRef} variant="outline" disabled={props.pending} onClick={props.onClose}>Cancelar</Button>
              <Button type="submit" variant={props.destructive ? "danger" : "primary"} disabled={props.pending} aria-describedby={props.error ? statusId : undefined}>
                {props.pending && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
                {props.pending ? "Processando…" : props.confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
