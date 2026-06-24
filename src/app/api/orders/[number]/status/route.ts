import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Status do pedido para o poller do PIX (página do pedido). Só o dono lê.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { number },
    select: { userId: true, status: true },
  });
  if (!order || order.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(
    { status: order.status },
    { headers: { "Cache-Control": "no-store" } }
  );
}
