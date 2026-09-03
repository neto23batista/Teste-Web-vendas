"use client";

import dynamic from "next/dynamic";

function ChartLoading() {
  return <div role="status" className="grid min-h-80 place-items-center rounded-2xl border border-border bg-muted text-sm text-muted-foreground">Carregando gráfico…</div>;
}

// The chart engine is isolated from the storefront and loaded as a separate chunk.
export const SalesAreaChart = dynamic(() => import("./charts-content").then((m) => m.SalesAreaChart), { loading: ChartLoading });
export const TopProductsBar = dynamic(() => import("./charts-content").then((m) => m.TopProductsBar), { loading: ChartLoading });
export const StatusDonut = dynamic(() => import("./charts-content").then((m) => m.StatusDonut), { loading: ChartLoading });
