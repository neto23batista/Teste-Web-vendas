"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog, type ConfirmationReason } from "@/components/ui/confirm-dialog";
import { publicError, safeWarning } from "@/client/api/result";

type ActionResult = { ok: boolean; error?: string; warning?: string };
type ActionOptions = {
  action: (reason: string) => Promise<ActionResult>;
  successMessage: string;
  onSuccess?: () => void;
  errorFallback?: string;
  warningMessage?: string;
};
type ConfirmationOptions = ActionOptions & {
  confirmMessage: string;
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  reason?: ConfirmationReason;
};

/** Bloqueia repetições antes do primeiro render e só anuncia sucesso confirmado. */
export function useConfirmAction(defaultOptions?: ConfirmationOptions) {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState<ConfirmationOptions | null>(null);
  const [pending, setPending] = React.useState(false);
  const [refreshPending, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const busy = React.useRef(false);
  const opened = React.useRef(false);
  const triggerElement = React.useRef<HTMLElement | null>(null);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  function close() {
    if (busy.current) return;
    opened.current = false;
    setConfirmation(null);
    setError(null);
  }

  async function execute(options: ActionOptions, reason = "") {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await options.action(reason);
      if (!result.ok) {
        const failure = publicError(result);
        const message = `${failure.message}${failure.reference ? ` Referência: ${failure.reference}.` : ""}`;
        setError(message);
        if (!opened.current) toast.error(message);
        refresh();
        return;
      }
      if (result.warning) toast.warning(options.warningMessage ?? safeWarning(result.warning) ?? "Alteração registrada com uma pendência. Confira os dados atualizados.");
      else toast.success(options.successMessage);
      opened.current = false;
      setConfirmation(null);
      options.onSuccess?.();
      refresh();
    } catch (cause) {
      const failure = publicError(cause);
      const message = `${failure.message}${failure.reference ? ` Referência: ${failure.reference}.` : ""}`;
      setError(message);
      if (!opened.current) toast.error(message);
      refresh();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function confirm(options: ConfirmationOptions) {
    if (busy.current || opened.current || refreshPending) return;
    opened.current = true;
    triggerElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(null);
    setConfirmation(options);
  }

  return {
    pending: pending || refreshPending,
    error,
    trigger: () => { if (defaultOptions) confirm(defaultOptions); },
    confirm,
    run: (options: ActionOptions) => { if (!opened.current && !refreshPending) return execute(options); },
    dialog: React.createElement(ConfirmDialog, {
      open: confirmation !== null,
      title: confirmation?.title ?? "Confirmar operação",
      description: confirmation?.confirmMessage ?? "",
      confirmLabel: confirmation?.confirmLabel ?? "Confirmar",
      destructive: confirmation?.destructive,
      reason: confirmation?.reason,
      pending: pending || refreshPending,
      error,
      onClose: close,
      onConfirm: (reason) => { if (confirmation) void execute(confirmation, reason); },
      onRefresh: () => { close(); refresh(); },
      onRestoreFocus: () => triggerElement.current?.focus(),
    }),
  };
}
