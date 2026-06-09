import Link from "next/link";
import type { Metadata } from "next";
import { FileText, CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserPrescriptions } from "@/lib/account";

export const metadata: Metadata = { title: "Receitas" };

const statusMeta = {
  PENDING: { label: "Em análise", icon: Clock, className: "text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300" },
  APPROVED: { label: "Aprovada", icon: CheckCircle2, className: "text-success-600 bg-success-500/10" },
  REJECTED: { label: "Recusada", icon: XCircle, className: "text-danger-500 bg-danger-500/10" },
} as const;

export default async function PrescriptionsPage() {
  const user = await requireUser();
  const prescriptions = await getUserPrescriptions(user.id);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Minhas receitas</h2>
        <p className="text-sm text-muted-foreground">
          Receitas enviadas no checkout para validação farmacêutica.
        </p>
      </div>

      {prescriptions.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="font-semibold">Nenhuma receita enviada</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ao comprar itens que exigem receita, envie o documento no checkout —
            ele aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {prescriptions.map((p) => {
            const meta = statusMeta[p.status];
            const Icon = meta.icon;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.order ? `Pedido ${p.order.number}` : "Receita avulsa"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                  <Icon className="size-3.5" /> {meta.label}
                </span>
                <Link
                  href={`/api/prescriptions/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Ver
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
