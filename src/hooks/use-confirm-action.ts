"use client";

import * as React from "react";
import { toast } from "sonner";

type ActionResult = { ok: boolean; error?: string };

/**
 * Fluxo compartilhado dos botões destrutivos: confirma (window.confirm), roda a
 * Server Action dentro de uma transição e traduz o resultado em toast. Centraliza
 * o try/catch — se a action LANÇA (sessão expirada, rede, action id inválido após
 * deploy), vira um toast de erro em vez de estourar o error boundary. Trocar o
 * window.confirm por um AlertDialog no futuro é mudança de um lugar só.
 */
export function useConfirmAction(opts: {
  confirmMessage: string;
  action: () => Promise<ActionResult>;
  successMessage: string;
  onSuccess?: () => void;
  errorFallback?: string;
}) {
  const [pending, start] = React.useTransition();

  function trigger() {
    if (!window.confirm(opts.confirmMessage)) return;
    start(async () => {
      try {
        const res = await opts.action();
        if (res.ok) {
          toast.success(opts.successMessage);
          opts.onSuccess?.();
        } else {
          toast.error(res.error ?? opts.errorFallback ?? "Não foi possível concluir a ação.");
        }
      } catch {
        toast.error(
          opts.errorFallback ?? "Não foi possível concluir a ação. Tente novamente."
        );
      }
    });
  }

  return { pending, trigger };
}
