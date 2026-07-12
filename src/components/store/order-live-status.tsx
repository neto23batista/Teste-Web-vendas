"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Acompanhamento AO VIVO do pedido: a cada 12s consulta o status no servidor
 * (query leve — 2 campos) e, SÓ quando algo mudou (status do pedido ou da
 * receita), chama router.refresh() — a página inteira reflete a mudança sem
 * reload. Cobre o pós-pagamento (PAID→PREPARING→SHIPPED→DELIVERED) e a
 * validação farmacêutica; o poller do PIX (pix-payment.tsx) cobre só o PENDING.
 *
 * Pausa com a aba oculta (mesma política do AutoRefresh) e para de vez ao
 * chegar num estado terminal (entregue/cancelado).
 */
export function OrderLiveStatus({
  orderNumber,
  initialStatus,
}: {
  orderNumber: string;
  initialStatus: string;
}) {
  const router = useRouter();

  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const tick = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status`, {
          cache: "no-store",
        });
        // Pedido removido (ex.: admin excluiu) → para o poll e recarrega.
        if (res.status === 404) {
          stop();
          router.refresh();
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (!active || !data.status) return;
        if (data.status !== initialStatus) {
          // O refresh re-renderiza a página com o dado novo; este componente
          // remonta com o novo initialStatus (ou sai, se o pedido virou terminal).
          stop();
          router.refresh();
        } else if (data.status === "DELIVERED" || data.status === "CANCELED") {
          stop(); // nada mais vai mudar — não gasta rede/banco à toa
        }
      } catch {
        // rede instável — tenta de novo no próximo tick.
      }
    };

    const start = () => {
      if (id == null) id = setInterval(tick, 12_000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderNumber, initialStatus, router]);

  return null;
}
