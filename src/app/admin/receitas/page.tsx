import Link from "next/link";
import { FileText, Inbox } from "lucide-react";
import type { PrescriptionStatus } from "@prisma/client";
import { getPrescriptionsByStatus } from "@/lib/admin";
import { PrescriptionReview } from "@/components/admin/prescription-review";
import { AutoRefresh } from "@/components/auto-refresh";
import { cn } from "@/lib/utils";

export const metadata = { title: "Receitas" };

const tabs: { status: PrescriptionStatus; label: string }[] = [
  { status: "PENDING", label: "Pendentes" },
  { status: "APPROVED", label: "Aprovadas" },
  { status: "REJECTED", label: "Recusadas" },
];

export default async function AdminPrescriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status: PrescriptionStatus = tabs.some((t) => t.status === sp.status)
    ? (sp.status as PrescriptionStatus)
    : "PENDING";
  const prescriptions = await getPrescriptionsByStatus(status);

  return (
    <div className="space-y-6">
      {/* Fila viva: receitas novas aparecem sem o farmacêutico recarregar. */}
      <AutoRefresh intervalMs={30_000} />
      <div>
        <h1 className="text-2xl font-extrabold">Receitas</h1>
        <p className="text-sm text-muted-foreground">
          {status === "PENDING"
            ? `${prescriptions.length} ${prescriptions.length === 1 ? "pendente" : "pendentes"} de validação farmacêutica`
            : `Histórico das ${prescriptions.length} mais recentes`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.status}
            href={
              t.status === "PENDING"
                ? "/admin/receitas"
                : `/admin/receitas?status=${t.status}`
            }
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              status === t.status
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-border bg-card hover:border-brand-300"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {prescriptions.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="font-semibold">
            {status === "PENDING"
              ? "Nenhuma receita pendente"
              : "Nada por aqui ainda"}
          </p>
          <p className="text-sm text-muted-foreground">
            {status === "PENDING"
              ? "Tudo validado por aqui."
              : "Nenhuma receita com este status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.order && (
                    <>
                      Pedido{" "}
                      <Link
                        href={`/admin/pedidos/${p.order.id}`}
                        className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {p.order.number}
                      </Link>{" "}
                      ·{" "}
                    </>
                  )}
                  {new Date(p.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <Link
                href={`/api/prescriptions/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Ver arquivo
              </Link>
              <PrescriptionReview id={p.id} status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
