import type { Metadata } from "next";
import { Plug, CheckCircle2, XCircle, Clock, CircleSlash } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAdminScope } from "@/lib/session";
import { formatBRL, cn } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  GenerateTokenButton,
  RetryExportButton,
} from "@/components/admin/integration-controls";

export const metadata: Metadata = { title: "Integração InovaFarma" };
export const dynamic = "force-dynamic";

const fmtData = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function AdminIntegrationPage() {
  const scope = await getAdminScope();
  const pharmacies = await prisma.pharmacy.findMany({
    where: scope.isGlobal ? {} : { id: scope.pharmacyId ?? "" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, integrationTokenHash: true },
  });

  const data = await Promise.all(
    pharmacies.map(async (ph) => {
      const [lastSync, pending, errors, sentCount] = await Promise.all([
        prisma.syncRun.findFirst({
          where: { pharmacyId: ph.id, kind: "CATALOG" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.orderExport.count({ where: { pharmacyId: ph.id, status: "PENDING" } }),
        prisma.orderExport.findMany({
          where: { pharmacyId: ph.id, status: "ERROR" },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { order: { select: { number: true, total: true } } },
        }),
        prisma.orderExport.count({ where: { pharmacyId: ph.id, status: "SENT" } }),
      ]);
      return { ph, lastSync, pending, errors, sentCount };
    })
  );

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30_000} />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Plug className="size-6 text-brand-600 dark:text-brand-400" /> Integração InovaFarma
        </h1>
        <p className="text-sm text-muted-foreground">
          Conector por unidade: catálogo/estoque/preço entram do PDV; pedidos pagos viram venda no caixa.
          Guia completo em <code className="text-xs">docs/INTEGRACAO-INOVAFARMA.md</code>.
        </p>
      </div>

      {data.map(({ ph, lastSync, pending, errors, sentCount }) => (
        <section key={ph.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">
                {ph.name}{" "}
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {ph.type === "MATRIZ" ? "matriz" : "filial"}
                </span>
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                {ph.integrationTokenHash ? (
                  <>
                    <CheckCircle2 className="size-4 text-success-600" /> Conector habilitado
                  </>
                ) : (
                  <>
                    <CircleSlash className="size-4" /> Sem token — conector ainda não configurado
                  </>
                )}
              </p>
            </div>
            <GenerateTokenButton pharmacyId={ph.id} hasToken={!!ph.integrationTokenHash} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Último sync de catálogo
              </p>
              {lastSync ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  {lastSync.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success-600" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-danger-500" />
                  )}
                  {fmtData(lastSync.createdAt)} — {lastSync.message ?? `${lastSync.items} itens`}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">nunca sincronizou</p>
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pedidos aguardando exportação
              </p>
              <p className={cn("mt-1 flex items-center gap-1.5 text-sm font-semibold", pending > 0 && "text-amber-600 dark:text-amber-400")}>
                <Clock className="size-4 shrink-0" /> {pending}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vendas exportadas
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 className="size-4 shrink-0 text-success-600" /> {sentCount}
              </p>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-danger-500">Exportações com erro</p>
              <div className="divide-y divide-border rounded-xl border border-danger-500/30">
                {errors.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {e.order.number} · {formatBRL(e.order.total)} · {e.attempts}{" "}
                        {e.attempts === 1 ? "tentativa" : "tentativas"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{e.lastError}</p>
                    </div>
                    <RetryExportButton orderExportId={e.id} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
