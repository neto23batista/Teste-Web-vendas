import { getCurrentUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { getPurchaseSuggestions } from "@/lib/admin-reports";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pedido de compra eletrônico (CSV) — só os itens que precisam de reposição. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || !canAccess(user.staffProfile, "compras")) {
    return new Response("Acesso negado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { rows } = await getPurchaseSuggestions(searchParams.get("unit"));
  const toBuy = rows.filter((r) => r.suggested > 0);

  const header = [
    "SKU",
    "EAN",
    "Produto",
    "Categoria",
    "Estoque",
    "Minimo",
    "Maximo",
    "QtdComprar",
    "CustoUnit",
    "CustoTotal",
  ];
  const lines = toBuy.map((r) => [
    r.sku ?? "",
    r.ean ?? "",
    r.name,
    r.category,
    r.stock,
    r.minStock,
    r.maxStock ?? "",
    r.suggested,
    r.costPrice != null ? r.costPrice.toFixed(2) : "",
    r.costPrice != null ? (r.costPrice * r.suggested).toFixed(2) : "",
  ]);

  // BOM (﻿) para o Excel reconhecer o UTF-8 (acentos).
  const csv = "﻿" + toCsv([header, ...lines]);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedido-compra-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
