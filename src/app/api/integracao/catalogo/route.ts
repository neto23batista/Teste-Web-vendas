import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pharmacyFromRequest } from "@/lib/integration-auth";
import { upsertCatalog } from "@/lib/integration-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lotes grandes de catálogo podem demorar (upsert item a item).
export const maxDuration = 60;

/**
 * Recebe o catálogo da InovaFarma enviado pelo conector da unidade:
 * `{ produtos: [{ sku, ean?, nome, preco, promo?, estoque, tarja?, categoria? }] }`.
 * O estoque atualiza SEMPRE a Inventory da unidade dona do token.
 */
export async function POST(req: NextRequest) {
  const pharmacy = await pharmacyFromRequest(req);
  if (!pharmacy) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    produtos?: unknown[];
  } | null;
  if (!body || !Array.isArray(body.produtos)) {
    return NextResponse.json(
      { error: "corpo inválido — esperado { produtos: [...] }" },
      { status: 400 }
    );
  }
  if (body.produtos.length > 2000) {
    return NextResponse.json(
      { error: "lote grande demais — envie em páginas de até 2000" },
      { status: 413 }
    );
  }

  const result = await upsertCatalog(pharmacy.id, body.produtos);

  await prisma.syncRun.create({
    data: {
      pharmacyId: pharmacy.id,
      kind: "CATALOG",
      ok: result.errors.length === 0,
      items: result.created + result.updated,
      message:
        result.errors.length > 0
          ? result.errors.slice(0, 5).join("; ").slice(0, 500)
          : `${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados`,
    },
  });

  return NextResponse.json({
    ok: result.errors.length === 0,
    criados: result.created,
    atualizados: result.updated,
    ignorados: result.skipped,
    erros: result.errors,
  });
}
