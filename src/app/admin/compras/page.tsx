import type { Metadata } from "next";
import { ShoppingBasket, Download, PackageCheck, Clock3 } from "lucide-react";
import { getAdminPurchasesView } from "@/server/queries/admin/inventory";
import { formatBRL, cn } from "@/lib/utils";
import { ProductImage } from "@/components/store/product-image";
import { StockLevels } from "@/components/admin/inventory/stock-levels";
import { LotReceipt, LotWriteOff } from "@/components/admin/inventory/inventory-lot-controls";

export const metadata: Metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const unit = one(sp.unit) || undefined;
  const { unitId, rows, lots, toBuy, estimated, missingCost } = await getAdminPurchasesView(unit);
  const exportHref = `/api/admin/purchases/export${unit ? `?unit=${unit}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <ShoppingBasket className="size-6 text-brand-600 dark:text-brand-400" /> Compras
          </h1>
          <p className="text-sm text-muted-foreground">
            Sugestão de reposição: quando o estoque chega ao mínimo, o sistema
            calcula quanto comprar para voltar ao máximo.
          </p>
        </div>
        {toBuy.length > 0 && (
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted"
          >
            <Download className="size-4" /> Exportar pedido de compra (CSV)
          </a>
        )}
      </div>

      {toBuy.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <PackageCheck className="size-5" /> Nenhum produto precisa de reposição agora.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            {toBuy.length} {toBuy.length === 1 ? "produto precisa" : "produtos precisam"} de
            reposição
          </span>
          <span className="text-amber-700/80 dark:text-amber-300/80">
            · custo estimado {formatBRL(estimated)}
            {missingCost ? " (itens sem custo cadastrado ficam de fora da estimativa)" : ""}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum produto ativo no estoque desta unidade.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Produto</th>
                  <th className="p-4 text-right font-semibold">Estoque</th>
                  <th className="p-4 font-semibold">Mín / Máx</th>
                  <th className="p-4 text-right font-semibold">Sugerido</th>
                  <th className="p-4 text-right font-semibold">Custo est.</th>
                  <th className="p-4 font-semibold">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr
                    key={r.inventoryId}
                    className={cn(
                      "transition hover:bg-muted/30",
                      r.suggested > 0 && "bg-amber-50/60 dark:bg-amber-500/5"
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ProductImage
                          emoji={r.emoji}
                          name={r.name}
                          className="size-10 rounded-xl"
                          emojiClassName="text-lg"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.category}
                            {r.sku ? ` · ${r.sku}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "p-4 text-right font-bold tabular-nums",
                        r.stock <= r.minStock &&
                          "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {r.stock}
                    </td>
                    <td className="p-4">
                      <StockLevels
                        inventoryId={r.inventoryId}
                        minStock={r.minStock}
                        maxStock={r.maxStock}
                      />
                    </td>
                    <td className="p-4 text-right">
                      {r.suggested > 0 ? (
                        <span className="inline-flex rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                          + {r.suggested} un
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right tabular-nums text-muted-foreground">
                      {r.suggested > 0 && r.costPrice != null
                        ? formatBRL(r.costPrice * r.suggested)
                        : "—"}
                    </td>
                    <td className="p-4 align-top">
                      {unitId && (
                        <LotReceipt
                          productId={r.productId}
                          pharmacyId={unitId}
                          suggested={r.suggested}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Clock3 className="size-5 text-brand-600 dark:text-brand-400" /> Lotes e validades
          </h2>
          <p className="text-sm text-muted-foreground">
            Saldo rastreável por lote, ordenado pela validade mais próxima.
          </p>
        </div>
        {lots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum lote recebido nesta unidade.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold">Produto</th>
                  <th className="p-3 font-semibold">Lote</th>
                  <th className="p-3 font-semibold">Validade</th>
                  <th className="p-3 text-right font-semibold">Saldo</th>
                  <th className="p-3 font-semibold">Fornecedor</th>
                  <th className="p-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lots.map((lot) => {
                  const days = lot.daysToExpiry;
                  return (
                    <tr key={lot.id} className={days <= 90 ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                      <td className="p-3 font-semibold">{lot.product.name}</td>
                      <td className="p-3 font-mono text-xs">{lot.lotCode}</td>
                      <td className="p-3">
                        {lot.expiresAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        {days <= 90 && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                            {days < 0 ? "vencido" : days === 0 ? "vence hoje" : `${days} dias`}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold">{lot.qty}</td>
                      <td className="p-3 text-muted-foreground">{lot.supplier ?? "—"}</td>
                      <td className="p-3">
                        {unitId && <LotWriteOff lotId={lot.id} pharmacyId={unitId} available={lot.qty} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        O máximo é o alvo da reposição (vazio = 2× o mínimo). O CSV exportado é o
        pedido eletrônico para enviar ao fornecedor/distribuidor.
      </p>
    </div>
  );
}
