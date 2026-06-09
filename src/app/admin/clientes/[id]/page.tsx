import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  IdCard,
  Star,
  MapPin,
  Package,
  ChevronRight,
} from "lucide-react";
import { getAdminCustomer } from "@/lib/admin";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getAdminCustomer(id);
  if (!customer) notFound();

  const totalSpent = customer.orders
    .filter((o) => o.status !== "CANCELED" && o.status !== "PENDING")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Cliente desde {new Date(customer.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Star className="size-4 fill-current" />
          {customer.loyalty?.points ?? 0} pontos
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Pedidos</p>
          <p className="mt-1 text-2xl font-extrabold">{customer.orders.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Total gasto</p>
          <p className="mt-1 text-2xl font-extrabold text-brand-700 dark:text-brand-400">
            {formatBRL(totalSpent)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Endereços</p>
          <p className="mt-1 text-2xl font-extrabold">{customer.addresses.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Pedidos */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Package className="size-5 text-brand-600 dark:text-brand-400" /> Pedidos
          </h2>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {customer.orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/pedidos/${o.id}`}
                  className="flex items-center gap-3 py-3 transition hover:opacity-80"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{o.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right font-bold">{formatBRL(o.total)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Contato + endereços */}
        <aside className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <p className="font-bold">Contato</p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> {customer.email}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" /> {customer.phone ?? "—"}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <IdCard className="size-4" /> {customer.cpf ?? "—"}
            </p>
          </div>

          {customer.addresses.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
              <p className="font-bold">Endereços</p>
              {customer.addresses.map((a) => (
                <div key={a.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <MapPin className="size-4 text-brand-600 dark:text-brand-400" />
                    {a.label}
                    {a.isDefault && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                        Padrão
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {a.street}, {a.number}
                    {a.complement ? ` - ${a.complement}` : ""}
                    <br />
                    {a.district}, {a.city}/{a.state} · CEP {a.zip}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
