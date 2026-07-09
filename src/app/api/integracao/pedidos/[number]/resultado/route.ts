import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pharmacyFromRequest } from "@/lib/integration-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O conector reporta o resultado da exportação de um pedido:
 * `{ ok: true, idVenda: "..." }` → SENT (venda criada na InovaFarma)
 * `{ ok: false, erro: "..." }`  → ERROR (re-tentado no próximo poll)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const pharmacy = await pharmacyFromRequest(req);
  if (!pharmacy) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { number },
    select: { id: true, pharmacyId: true },
  });
  if (!order || order.pharmacyId !== pharmacy.id) {
    return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    ok?: boolean;
    idVenda?: string;
    erro?: string;
  } | null;
  if (!body || typeof body.ok !== "boolean") {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (body.ok) {
    await prisma.orderExport.upsert({
      where: { orderId: order.id },
      update: {
        status: "SENT",
        externalSaleId: body.idVenda ?? null,
        lastError: null,
      },
      create: {
        orderId: order.id,
        pharmacyId: pharmacy.id,
        status: "SENT",
        externalSaleId: body.idVenda ?? null,
      },
    });
  } else {
    await prisma.orderExport.upsert({
      where: { orderId: order.id },
      update: {
        status: "ERROR",
        attempts: { increment: 1 },
        lastError: (body.erro ?? "erro não informado").slice(0, 500),
      },
      create: {
        orderId: order.id,
        pharmacyId: pharmacy.id,
        status: "ERROR",
        attempts: 1,
        lastError: (body.erro ?? "erro não informado").slice(0, 500),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
