"use client";

import { useOrderPolling } from "@/hooks/use-order-polling";
import { Button } from "@/components/ui/button";

export function OrderLiveStatus({ orderNumber, initialStatus, initialPaymentStatus }: { orderNumber: string; initialStatus: string; initialPaymentStatus?: string | null }) {
  const { unavailable, refresh } = useOrderPolling(orderNumber, initialStatus, 12_000, initialPaymentStatus);
  if (!unavailable) return null;
  return (
    <div role="status" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
      <p>A atualização automática está indisponível. O último estado confirmado foi preservado.</p>
      <Button variant="outline" size="sm" onClick={refresh} className="mt-2">Atualizar pedido</Button>
    </div>
  );
}
