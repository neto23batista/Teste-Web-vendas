import { NextRequest, NextResponse } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveUnitFilter } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sinal para o som de "pedido novo" do painel (order-chime.tsx): quantos
 * pedidos estão a processar (PAID/PREPARING) e qual o mais recente. Escopo por
 * unidade herda resolveUnitFilter (filial = a sua; matriz = ?unit= ou todas).
 * Só admin lê.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const unitParam = req.nextUrl.searchParams.get("unit") || undefined;
  const unit = await resolveUnitFilter(unitParam);
  const toProcess: OrderStatus[] = ["PAID", "PREPARING"];
  const where = {
    status: { in: toProcess },
    ...(unit ? { pharmacyId: unit } : {}),
  };

  const [count, latest] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { number: true, createdAt: true },
    }),
  ]);

  return NextResponse.json(
    {
      count,
      latestAt: latest?.createdAt.toISOString() ?? null,
      latestNumber: latest?.number ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
