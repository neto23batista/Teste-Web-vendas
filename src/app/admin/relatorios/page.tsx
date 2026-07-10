import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { requireArea } from "@/lib/session";
import { getAbcReport } from "@/lib/admin-reports";
import { formatBRL, cn } from "@/lib/utils";
import type { AbcClass } from "@/lib/management";

export const metadata: Metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PERIODS = [30, 60, 90] as const;

const CLASS_STYLE: Record<AbcClass, string> = {
  A: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  C: "bg-muted text-muted-foreground",
};

const CLASS_HINT: Record<AbcClass, string> = {
  A: "sustentam o faturamento — nunca deixar faltar",
  B: "importância média — repor com folga",
  C: "cauda longa — estoque enxuto",
};

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireArea("relatorios");
  const sp = await searchParams;
  const unit = one(sp.unit) || undefined;
  const daysRaw = Number(one(sp.days));
  const days = (PERIODS as readonly number[]).includes(daysRaw) ? daysRaw : 30;

  const { rows, totalRevenue, totalQty } = await getAbcReport(days, unit);
  const countBy = (c: AbcClass) => rows.filter((r) => r.abcClass === c).length;

  const periodHref = (d: number) => {
    const p = new URLSearchParams();
    if (d !== 30) p.set("days", String(d));
    if (unit) p.set("unit", unit);
    const s = p.toString();
    return `/admin/relatorios${s ? `?${s}` : ""}`;
  };
  const exportHref = `/api/admin/reports/abc/export?days=${days}${unit ? `&unit=${unit}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <BarChart3 className="size-6 text-brand-600 dark:text-brand-400" /> Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Curva ABC de vendas — o que sustenta o faturamento e o que é cauda longa.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted"
        >
          <Download className="size-4" /> Exportar CSV
        </a>
      </div>

      <div className="flex gap-2">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={periodHref(d)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              d === days
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-border bg-card hover:border-brand-300"
            )}
          >
            {d} dias
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Faturamento ({days} dias)
          </p>
          <p className="mt-1 text-2xl font-extrabold">{formatBRL(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Itens vendidos
          </p>
          <p className="mt-1 text-2xl font-extrabold">{totalQty}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Classes A · B · C
          </p>
          <p className="mt-1 text-2xl font-extrabold">
            {countBy("A")} · {countBy("B")} · {countBy("C")}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma venda no período — a curva ABC aparece assim que houver pedidos pagos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">#</th>
                  <th className="p-4 font-semibold">Produto</th>
                  <th className="p-4 text-right font-semibold">Qtd</th>
                  <th className="p-4 text-right font-semibold">Receita</th>
                  <th className="p-4 text-right font-semibold">% do total</th>
                  <th className="p-4 text-right font-semibold">% acumulado</th>
                  <th className="p-4 font-semibold">Classe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.key} className="transition hover:bg-muted/30">
                    <td className="p-4 text-muted-foreground">{i + 1}</td>
                    <td className="p-4 font-semibold">{r.name}</td>
                    <td className="p-4 text-right tabular-nums">{r.qty}</td>
                    <td className="p-4 text-right font-bold tabular-nums">
                      {formatBRL(r.revenue)}
                    </td>
                    <td className="p-4 text-right tabular-nums text-muted-foreground">
                      {pct(r.share)}
                    </td>
                    <td className="p-4 text-right tabular-nums text-muted-foreground">
                      {pct(r.cumulative)}
                    </td>
                    <td className="p-4">
                      <span
                        title={CLASS_HINT[r.abcClass]}
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                          CLASS_STYLE[r.abcClass]
                        )}
                      >
                        {r.abcClass}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Classe A: {CLASS_HINT.A}. Classe B: {CLASS_HINT.B}. Classe C: {CLASS_HINT.C}.
      </p>
    </div>
  );
}
