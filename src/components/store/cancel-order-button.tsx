"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelMyOrder } from "@/actions/checkout";
import { Button } from "@/components/ui/button";

export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function handleCancel() {
    if (
      !window.confirm(
        "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    start(async () => {
      const res = await cancelMyOrder(orderNumber);
      if (res.ok) {
        toast.success("Pedido cancelado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível cancelar o pedido.");
      }
    });
  }

  return (
    <Button
      onClick={handleCancel}
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
