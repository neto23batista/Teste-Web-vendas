"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { confirmPaymentSimulated } from "@/actions/checkout";
import { Button } from "@/components/ui/button";

export function SimulatePaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function confirm() {
    start(async () => {
      const res = await confirmPaymentSimulated(orderNumber);
      if (res.ok) {
        toast.success("Pagamento confirmado!");
        router.refresh();
      } else {
        toast.error("Não foi possível confirmar.");
      }
    });
  }

  return (
    <Button onClick={confirm} variant="success" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
      Confirmar pagamento (simulação)
    </Button>
  );
}
