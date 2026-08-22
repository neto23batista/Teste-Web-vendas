"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { retryOrderRefund } from "@/actions/admin-orders";
import { Button } from "@/components/ui/button";

export function RetryRefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await retryOrderRefund(orderId);
          if (!result.ok) toast.error(result.error);
          else if (result.warning) toast.warning(result.warning);
          else toast.success("Reembolso confirmado pelo Stripe.");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RotateCcw className="size-4" />
      )}
      Tentar reembolso novamente
    </Button>
  );
}
