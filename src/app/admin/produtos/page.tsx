import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { getAdminProducts } from "@/lib/admin";
import { formatBRL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/store/product-image";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Pagination } from "@/components/admin/pagination";

type SP = Record<string, string | string[] | undefined>;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() || undefined;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1;
  const { items: products, total, pages, page: current } = await getAdminProducts(q, page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{total} itens</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/produtos/importar">
              <Upload className="size-5" /> Importar CSV
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/admin/produtos/novo">
              <Plus className="size-5" /> Novo produto
            </Link>
          </Button>
        </div>
      </div>

      <form action="/admin/produtos" method="get" className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou SKU…"
          className="h-12 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-sm outline-none focus:border-brand-400"
        />
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 font-semibold">Produto</th>
                <th className="p-4 font-semibold">Categoria</th>
                <th className="p-4 font-semibold">Preço</th>
                <th className="p-4 font-semibold">Estoque</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => {
                const price = p.promoPrice ?? p.price;
                return (
                  <tr key={p.id} className="transition hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ProductImage emoji={p.emoji} name={p.name} className="size-10 rounded-xl" emojiClassName="text-lg" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand?.name ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{p.category.name}</td>
                    <td className="p-4">
                      <span className="font-semibold">{formatBRL(price)}</span>
                      {p.promoPrice != null && (
                        <span className="ml-1 text-xs text-muted-foreground line-through">
                          {formatBRL(p.price)}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                          p.stock <= 0
                            ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            : p.stock <= p.minStock
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        )}
                      >
                        {p.stock} un
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                          p.active
                            ? "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-4">
                      <ProductRowActions id={p.id} active={p.active} name={p.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={current} pages={pages} baseParams={{ q }} />
    </div>
  );
}
