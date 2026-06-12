import { AlertTriangle, PackageCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/store/product-image";
import { StockAdjust } from "@/components/admin/stock-adjust";

export const metadata = { title: "Estoque" };

export default async function AdminStockPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { category: { select: { name: true } } },
    orderBy: { stock: "asc" },
    take: 100,
  });
  const lowCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Controle de estoque</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste rápido das quantidades em estoque
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold",
          lowCount > 0
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        )}
      >
        {lowCount > 0 ? (
          <>
            <AlertTriangle className="size-5" /> {lowCount}{" "}
            {lowCount === 1 ? "produto precisa" : "produtos precisam"} de reposição
          </>
        ) : (
          <>
            <PackageCheck className="size-5" /> Estoque saudável em todos os produtos
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Mobile: lista em cards (a tabela não cabe na tela). */}
        <div className="divide-y divide-border md:hidden">
          {products.map((p) => {
            const out = p.stock <= 0;
            const low = !out && p.stock <= p.minStock;
            return (
              <div key={p.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <ProductImage
                    emoji={p.emoji}
                    name={p.name}
                    className="size-11 shrink-0 rounded-xl"
                    emojiClassName="text-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.category.name} · mín. {p.minStock} un
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      out
                        ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : low
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    )}
                  >
                    {out ? "Esgotado" : low ? "Baixo" : "Ok"}
                  </span>
                </div>
                <StockAdjust id={p.id} stock={p.stock} />
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 font-semibold">Produto</th>
                <th className="p-4 font-semibold">Mínimo</th>
                <th className="p-4 font-semibold">Situação</th>
                <th className="p-4 text-right font-semibold">Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => {
                const out = p.stock <= 0;
                const low = !out && p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="transition hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ProductImage emoji={p.emoji} name={p.name} className="size-10 rounded-xl" emojiClassName="text-lg" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{p.minStock} un</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                          out
                            ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            : low
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        )}
                      >
                        {out ? "Esgotado" : low ? "Baixo" : "Ok"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end">
                        <StockAdjust id={p.id} stock={p.stock} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
