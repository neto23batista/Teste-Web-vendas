import { getCurrentUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { getAbcReport } from "@/lib/admin-reports";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || !canAccess(user.staffProfile, "relatorios")) {
    return new Response("Acesso negado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const daysRaw = Number(searchParams.get("days"));
  const days = [30, 60, 90].includes(daysRaw) ? daysRaw : 30;
  const { rows } = await getAbcReport(days, searchParams.get("unit"));

  const header = ["Posicao", "Produto", "Qtd", "Receita", "PctTotal", "PctAcumulado", "Classe"];
  const lines = rows.map((r, i) => [
    i + 1,
    r.name,
    r.qty,
    r.revenue.toFixed(2),
    (r.share * 100).toFixed(1),
    (r.cumulative * 100).toFixed(1),
    r.abcClass,
  ]);

  // BOM (﻿) para o Excel reconhecer o UTF-8 (acentos).
  const csv = "﻿" + toCsv([header, ...lines]);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="curva-abc-${days}d-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
