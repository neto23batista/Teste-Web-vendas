"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { retryOrderRefund } from "@/client/api/admin";
import { Button } from "@/components/ui/button";

export function RetryRefundButton({ orderId }: { orderId: string }) {
  const { pending, trigger, dialog } = useConfirmAction({
    title: "Retomar reembolso do pedido",
    confirmLabel: "Consultar e retomar reembolso",
    confirmMessage: "O sistema verificará o reembolso existente antes de retomar a devolução do valor. O estoque e o cancelamento do pedido não serão repetidos.",
    action: () => retryOrderRefund(orderId),
    successMessage: "Reembolso confirmado pelo provedor.",
    warningMessage: "Reembolso ainda pendente ou em processamento. Acompanhe a confirmação no pedido.",
  });

  return (
    <>{dialog}<Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={trigger}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RotateCcw className="size-4" />
      )}
      Tentar reembolso novamente
    </Button></>
  );
}
