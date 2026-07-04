import type { Metadata } from "next";
import { Repeat, PauseCircle, CalendarClock } from "lucide-react";
import { getAdminScope } from "@/lib/session";
import { listAllSubscriptions, intervalLabel } from "@/lib/subscriptions";

export const metadata: Metadata = { title: "Assinaturas" };

const DAY_MS = 86_400_000;

// Fora do componente: Date.now() é impuro para a regra de pureza do compiler.
function countDueSoon(subs: { nextDueAt: Date }[]): number {
  const cutoff = Date.now() + 7 * DAY_MS;
  return subs.filter((s) => s.nextDueAt.getTime() <= cutoff).length;
}

export default async function AdminSubscriptionsPage() {
  const scope = await getAdminScope();
  if (!scope.isGlobal) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        As assinaturas são globais (não pertencem a uma unidade) e ficam
        visíveis apenas para a matriz.
      </div>
    );
  }

  const subs = await listAllSubscriptions();
  const active = subs.filter((s) => s.status === "ACTIVE");
  const paused = subs.filter((s) => s.status === "PAUSED");
  const dueSoon = countDueSoon(active);

  const kpis = [
    { icon: Repeat, label: "Ativas", value: active.length, accent: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300" },
    { icon: CalendarClock, label: "Vencem em 7 dias", value: dueSoon, accent: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300" },
    { icon: PauseCircle, label: "Pausadas", value: paused.length, accent: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          <span className="text-gradient-vivid">Assinaturas</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Reposição recorrente — o cliente é lembrado por e-mail no vencimento e
          confirma o pedido (sem cobrança automática).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <span className={`grid size-11 place-items-center rounded-2xl ${accent}`}>
              <Icon className="size-5" />
            </span>
            <p className="mt-3 text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
        {subs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma assinatura ainda. Elas aparecem aqui quando clientes ativarem
            a reposição recorrente nas páginas de produto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Produto</th>
                  <th className="px-5 py-3 font-semibold">Qtde</th>
                  <th className="px-5 py-3 font-semibold">Frequência</th>
                  <th className="px-5 py-3 font-semibold">Próxima reposição</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{s.user.name}</p>
                      <p className="text-xs text-muted-foreground">{s.user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="mr-1.5" aria-hidden>
                        {s.product.emoji ?? "💊"}
                      </span>
                      {s.product.name}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{s.qty}</td>
                    <td className="px-5 py-3">{intervalLabel(s.intervalDays)}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {s.nextDueAt.toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          s.status === "ACTIVE"
                            ? "rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-bold text-success-600"
                            : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                        }
                      >
                        {s.status === "ACTIVE" ? "Ativa" : "Pausada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
