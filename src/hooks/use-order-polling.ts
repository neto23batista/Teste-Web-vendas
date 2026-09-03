"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getOrderStatus } from "@/client/api/orders";

/** Private reads, no overlapping requests, paused in background tabs. */
export function useOrderPolling(orderNumber: string, initialStatus: string, interval = 12_000, initialPaymentStatus?: string | null) {
  const router = useRouter();
  const [unavailable, setUnavailable] = React.useState(false);
  const [observed, setObserved] = React.useState<{ number: string; status: string; payment: string | null } | null>(null);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let disposed = false;
    const stop = () => {
      clearTimeout(timer);
      request?.abort();
      request = undefined;
    };
    const tick = async () => {
      if (disposed || request || document.visibilityState !== "visible") return;
      const controller = new AbortController();
      request = controller;
      const result = await getOrderStatus(orderNumber, { signal: controller.signal });
      if (request !== controller) return;
      request = undefined;
      if (disposed || controller.signal.aborted) return;
      setUnavailable(!result.ok);
      if (result.ok) setObserved({ number: orderNumber, status: result.data.status, payment: result.data.paymentStatus });
      if ((!result.ok && result.code === "NOT_FOUND") || (result.ok && (result.data.status !== initialStatus || (initialPaymentStatus !== undefined && result.data.paymentStatus !== initialPaymentStatus)))) {
        router.refresh();
        // Keep trying until RSC props acknowledge the change, even if refresh failed.
        timer = setTimeout(() => void tick(), interval);
        return;
      }
      if (!result.ok && (result.code === "UNAUTHORIZED" || result.code === "FORBIDDEN")) {
        router.refresh();
        return;
      }
      if (result.ok && ["DELIVERED", "CANCELED"].includes(result.data.status) && !["REFUND_PENDING", "REFUND_FAILED", "QUARANTINED"].includes(result.data.paymentStatus ?? "")) return;
      timer = setTimeout(() => void tick(), interval);
    };
    const onVisibility = () => {
      stop();
      // An aborted request finishes before scheduling the next foreground read.
      if (document.visibilityState === "visible") timer = setTimeout(() => void tick(), 100);
    };
    timer = setTimeout(() => void tick(), interval);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderNumber, initialStatus, initialPaymentStatus, interval, router]);

  const changed = observed?.number === orderNumber && (observed.status !== initialStatus || (initialPaymentStatus !== undefined && observed.payment !== initialPaymentStatus));
  return { unavailable, changed, refresh: () => router.refresh() };
}
