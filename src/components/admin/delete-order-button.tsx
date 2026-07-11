"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteOrder } from "@/actions/admin-orders";
import { useConfirmAction } from "@/components/use-confirm-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de EXCLUSÃO PERMANENTE de um pedido (dono/gerente). Dois formatos:
 * - `compact`: ícone de lixeira para as linhas da lista;
 * - padrão: botão "Excluir pedido" para a página de detalhe.
 * `redirectToList` leva de volta à lista após excluir (o detalhe deixa de existir).
 */
export function DeleteOrderButton({
  orderId,
  orderNumber,
  compact = false,
  redirectToList = false,
  className,
}: {
  orderId: string;
  orderNumber: string;
  compact?: boolean;
  redirectToList?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { pending, trigger } = useConfirmAction({
    confirmMessage:
      `Excluir o pedido ${orderNumber} permanentemente?\n\n` +
      "O registro será apagado e não poderá ser recuperado. Isto NÃO estorna " +
      "pagamento nem devolve estoque — para isso, cancele o pedido.",
    action: () => deleteOrder(orderId),
    successMessage: `Pedido ${orderNumber} excluído.`,
    onSuccess: () => (redirectToList ? router.push("/admin/pedidos") : router.refresh()),
    errorFallback: "Não foi possível excluir o pedido.",
  });

  const icon = pending ? (
    <Loader2 className={cn(compact ? "size-4" : "size-5", "animate-spin")} />
  ) : (
    <Trash2 className={compact ? "size-4" : "size-5"} />
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        aria-label={`Excluir pedido ${orderNumber}`}
        title="Excluir pedido"
        className={cn(
          "inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50",
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
      className={cn("w-full text-danger-500 hover:bg-danger-500/10", className)}
    >
      {icon}
      Excluir pedido
    </Button>
  );
}
