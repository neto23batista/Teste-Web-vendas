import { AlertTriangle, PackageCheck, PackageSearch } from "lucide-react";
import { getStockRows } from "@/lib/admin";
import { getAdminScope } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/store/product-image";
import { StockAdjust } from "@/components/admin/stock-adjust";
import { StockTransfer } from "@/components/admin/stock-transfer";
import { UnitOfferEditor } from "@/components/admin/unit-offer-editor";
import type { InventoryMovementKind } from "@prisma/client";

export const metadata = { title: "Estoque" };

type SP = Record<string, string | string[] | undefined>;

const movementLabel: Record<InventoryMovementKind, string> = {
  MANUAL_ADJUSTMENT: "Ajuste manual",
  TRANSFER_IN: "Transferência recebida",
  TRANSFER_OUT: "Transferência enviada",
  SALE: "Venda",
  CANCELLATION: "Cancelamento",
  RETURN: "Devolução",
  RECEIPT: "Recebimento",
  LOSS: "Perda",
  SYNC: "Sincronização",
  RESERVATION: "Reserva",
  RELEASE: "Liberação",
};

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const unit = (Array.isArray(sp.unit) ? sp.unit[0] : sp.unit) || undefined;
  const [{ unitId, rows }, scope] = await Promise.all([
    getStockRows(unit),
    getAdminScope(),
  ]);
  const lowCount = rows.filter((p) => p.stock <= p.minStock).length;

  // Transferência entre unidades é exclusiva da matriz. Carrega as unidades e o
  // estoque de cada produto por unidade (para mostrar de/para onde mover).
  const canTransfer = scope.isGlobal && !!unitId;
  let units: { id: string; name: string }[] = [];
  const stockByProduct: Record<string, Record<string, number>> = {};
  if (canTransfer && rows.length > 0) {
    const [unitList, invs] = await Promise.all([
      prisma.pharmacy.findMany({
        where: { active: true, archivedAt: null },
        select: { id: true, name: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.inventory.findMany({
        where: { productId: { in: rows.map((r) => r.productId) } },
        select: { productId: true, pharmacyId: true, stock: true },
      }),
    ]);
    units = unitList;
    for (const iv of invs) {
      (stockByProduct[iv.productId] ??= {})[iv.pharmacyId] = iv.stock;
    }
  }
  const showTransfer = canTransfer && units.length > 1;
  const movements = unitId
    ? await prisma.inventoryMovement.findMany({
        where: { pharmacyId: unitId },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];
  const movementProducts = movements.length
    ? await prisma.product.findMany({
        where: { id: { in: [...new Set(movements.map((movement) => movement.productId))] } },
        select: { id: true, name: true },
      })
    : [];
  const productNames = new Map(movementProducts.map((product) => [product.id, product.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Controle de estoque</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste rápido das quantidades em estoque da unidade
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold",
          rows.length === 0
            ? "border-border bg-muted/30 text-muted-foreground"
            : lowCount > 0
              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        )}
      >
        {rows.length === 0 ? (
          <>
            <PackageSearch className="size-5 shrink-0" aria-hidden="true" />
            Nenhum produto ativo encontrado no estoque desta unidade
          </>
        ) : lowCount > 0 ? (
          <>
            <AlertTriangle className="size-5" aria-hidden="true" /> {lowCount}{" "}
            {lowCount === 1 ? "produto precisa" : "produtos precisam"} de reposição
          </>
        ) : (
          <>
            <PackageCheck className="size-5" aria-hidden="true" /> Estoque saudável em todos os produtos
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-5 py-14 text-center">
          <PackageSearch
            className="size-9 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="font-semibold">Estoque sem itens para exibir</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cadastre ou ative produtos e vincule o estoque à unidade. Se você
            administra mais de uma loja, confirme também a unidade selecionada.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Mobile: lista em cards (a tabela não cabe na tela). */}
          <div className="divide-y divide-border md:hidden">
          {rows.map((p) => {
            const out = p.stock <= 0;
            const low = !out && p.stock <= p.minStock;
            return (
              <div key={p.productId} className="space-y-3 p-4">
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
                      {p.category} · mín. {p.minStock} un
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
                {unitId && (
                  <div className="space-y-3">
                    <UnitOfferEditor
                      productId={p.productId}
                      pharmacyId={unitId}
                      price={p.price}
                      promoPrice={p.promoPrice}
                      costPrice={p.costPrice}
                      sku={p.sku}
                      ean={p.ean}
                    />
                    <StockAdjust id={p.productId} pharmacyId={unitId} stock={p.stock} />
                  </div>
                )}
                {showTransfer && unitId && (
                  <StockTransfer
                    productId={p.productId}
                    fromUnitId={unitId}
                    units={units}
                    perUnit={stockByProduct[p.productId] ?? {}}
                  />
                )}
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
                <th className="p-4 font-semibold">Oferta da unidade</th>
                <th className="p-4 text-right font-semibold">Estoque</th>
                {showTransfer && (
                  <th className="p-4 font-semibold">Transferir</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => {
                const out = p.stock <= 0;
                const low = !out && p.stock <= p.minStock;
                return (
                  <tr key={p.productId} className="transition hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ProductImage emoji={p.emoji} name={p.name} className="size-10 rounded-xl" emojiClassName="text-lg" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
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
                    <td className="p-4 align-top">
                      {unitId && (
                        <UnitOfferEditor
                          productId={p.productId}
                          pharmacyId={unitId}
                          price={p.price}
                          promoPrice={p.promoPrice}
                          costPrice={p.costPrice}
                          sku={p.sku}
                          ean={p.ean}
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end">
                        {unitId && (
                          <StockAdjust id={p.productId} pharmacyId={unitId} stock={p.stock} />
                        )}
                      </div>
                    </td>
                    {showTransfer && (
                      <td className="p-4">
                        {unitId && (
                          <StockTransfer
                            productId={p.productId}
                            fromUnitId={unitId}
                            units={units}
                            perUnit={stockByProduct[p.productId] ?? {}}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Movimentos recentes</h2>
          <p className="text-sm text-muted-foreground">
            Últimas 50 alterações com saldo anterior, saldo final, motivo e responsável.
          </p>
        </div>
        {movements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum movimento auditado nesta unidade ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold">Data</th>
                  <th className="p-3 font-semibold">Produto</th>
                  <th className="p-3 font-semibold">Operação</th>
                  <th className="p-3 text-right font-semibold">Variação</th>
                  <th className="p-3 text-right font-semibold">Saldo</th>
                  <th className="p-3 font-semibold">Motivo / ator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {movement.createdAt.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 font-semibold">
                      {productNames.get(movement.productId) ?? movement.productId}
                    </td>
                    <td className="p-3">{movementLabel[movement.kind]}</td>
                    <td
                      className={cn(
                        "p-3 text-right font-bold",
                        movement.delta > 0 ? "text-success-600" : "text-danger-500"
                      )}
                    >
                      {movement.delta > 0 ? "+" : ""}{movement.delta}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">
                      {movement.stockBefore} → {movement.stockAfter}
                    </td>
                    <td className="max-w-xs p-3">
                      <p>{movement.reason}</p>
                      {movement.actorEmail && (
                        <p className="truncate text-xs text-muted-foreground">
                          {movement.actorEmail}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
