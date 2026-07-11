"use client";

import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { cancelMyOrder } from "@/actions/checkout";
import { useConfirmAction } from "@/components/use-confirm-action";
import { Button } from "@/components/ui/button";

export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const { pending, trigger } = useConfirmAction({
    confirmMessage:
      "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.",
    action: () => cancelMyOrder(orderNumber),
    successMessage: "Pedido cancelado.",
    onSuccess: () => router.refresh(),
    errorFallback: "Não foi possível cancelar o pedido.",
  });

  return (
    <Button
      onClick={trigger}
      variant="outline"
      size="lg"
      disabled={pending}
      className="text-danger-500 hover:bg-danger-500/10"
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <XCircle className="size-5" />
      )}
      Cancelar pedido
    </Button>
  );
}
