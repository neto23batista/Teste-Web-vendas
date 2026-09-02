"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { archiveOrder, restoreOrder } from "@/actions/admin/orders";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Arquivamento reversível: o registro financeiro e operacional nunca é apagado. */
export function OrderArchiveButton({
  orderId,
  orderNumber,
  archived = false,
  compact = false,
  redirectToList = false,
  className,
}: {
  orderId: string;
  orderNumber: string;
  archived?: boolean;
  compact?: boolean;
  redirectToList?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const verb = archived ? "Restaurar" : "Arquivar";
  const { pending, trigger } = useConfirmAction({
    confirmMessage: archived
      ? `Restaurar o pedido ${orderNumber} para a lista ativa?`
      : `Arquivar o pedido ${orderNumber}?\n\nO histórico será preservado e poderá ser restaurado.`,
    action: () => (archived ? restoreOrder(orderId) : archiveOrder(orderId)),
    successMessage: `${archived ? "Pedido restaurado" : "Pedido arquivado"}.`,
    onSuccess: () =>
      !archived && redirectToList
        ? router.push("/admin/pedidos")
        : router.refresh(),
    errorFallback: `Não foi possível ${verb.toLowerCase()} o pedido.`,
  });

  const Icon = archived ? ArchiveRestore : Archive;
  const icon = pending ? (
    <Loader2 className={cn(compact ? "size-4" : "size-5", "animate-spin")} />
  ) : (
    <Icon className={compact ? "size-4" : "size-5"} />
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        aria-label={`${verb} pedido ${orderNumber}`}
        title={`${verb} pedido`}
        className={cn(
          "inline-grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600 disabled:opacity-50",
          className
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <Button
      onClick={trigger}
      variant="outline"
      size="lg"
      disabled={pending}
      className={cn("w-full", className)}
    >
      {icon}
      {verb} pedido
    </Button>
  );
}
