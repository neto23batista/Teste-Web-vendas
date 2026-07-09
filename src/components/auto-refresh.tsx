"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-atualização da página sem reload: chama router.refresh() num intervalo —
 * o Next re-busca só os DADOS (payload RSC via fetch, o "AJAX" do App Router) e
 * o React atualiza o DOM no lugar, preservando scroll e o que está digitado.
 *
 * Custo consciente: com a aba OCULTA o interval para (ninguém olhando = zero
 * queries); ao voltar, faz um refresh imediato e religa — dado fresco na volta.
 *
 * Use em telas de MONITORAMENTO (listas de pedidos, dashboard, fila de
 * receitas). Evite em formulários de edição longos.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id == null) id = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
