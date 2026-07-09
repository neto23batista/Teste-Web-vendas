import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Status do pedido para os pollers da página do pedido (PIX + acompanhamento
// ao vivo). Só o dono lê. `rxStatus` = status da receita mais recente — a
// aprovação/recusa pelo admin também deve refletir na tela sem F5.
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
    select: {
      userId: true,
      status: true,
      prescriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });
  if (!order || order.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(
    { status: order.status, rxStatus: order.prescriptions[0]?.status ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
