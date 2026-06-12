import Link from "next/link";
import { Search, Star, ChevronRight } from "lucide-react";
import { getAdminCustomers } from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";

type SP = Record<string, string | string[] | undefined>;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() || undefined;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1;
  const { items: customers, total, pages, page: current } =
    await getAdminCustomers(q, page);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Clientes</h1>
        <p className="text-sm text-muted-foreground">{total} cadastrados</p>
      </div>

      <form action="/admin/clientes" method="get" className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, e-mail ou CPF…"
          className="h-12 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-sm outline-none focus:border-brand-400"
        />
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Mobile: lista em cards (a tabela não cabe na tela). */}
        <div className="divide-y divide-border md:hidden">
          {customers.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          )}
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clientes/${c.id}`}
              className="flex items-center justify-between gap-3 p-4 transition active:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c._count.orders}{" "}
                  {c._count.orders === 1 ? "pedido" : "pedidos"} · desde{" "}
                  {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="size-3.5 fill-current" />
                  {c.loyalty?.points ?? 0}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Telefone</th>
                <th className="p-4 font-semibold">Pedidos</th>
                <th className="p-4 font-semibold">Pontos</th>
                <th className="p-4 font-semibold">Desde</th>
                <th className="p-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="transition hover:bg-muted/30">
                  <td className="p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="p-4">
                    <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                      {c._count.orders}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Star className="size-3.5 fill-current" />
                      {c.loyalty?.points ?? 0}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Detalhes <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={current} pages={pages} baseParams={{ q }} />
    </div>
  );
}
