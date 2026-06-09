import Link from "next/link";
import { FileText, Inbox } from "lucide-react";
import { getPendingPrescriptions } from "@/lib/admin";
import { PrescriptionReview } from "@/components/admin/prescription-review";

export const metadata = { title: "Receitas" };

export default async function AdminPrescriptionsPage() {
  const prescriptions = await getPendingPrescriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Receitas a validar</h1>
        <p className="text-sm text-muted-foreground">
          {prescriptions.length}{" "}
          {prescriptions.length === 1 ? "pendente" : "pendentes"} de validação
          farmacêutica
        </p>
      </div>

      {prescriptions.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="font-semibold">Nenhuma receita pendente</p>
          <p className="text-sm text-muted-foreground">Tudo validado por aqui.</p>
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
