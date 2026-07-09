import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillOrder } from "@/lib/orders";
import { getPaymentStatus, pagbankConfigured } from "@/lib/pagbank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do PagBank. Segurança por RE-BUSCA: o payload só aponta QUAL
 * pedido/cobrança consultar — o status que vale é o que a API do PagBank
 * responde com o nosso token. Notificação forjada não aprova nada.
 */
export async function POST(req: NextRequest) {
  try {
    if (!pagbankConfigured()) return NextResponse.json({ received: true });

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return NextResponse.json({ received: true });

    // Notificações de order trazem id ORDE_...; as de cobrança, CHAR_...
    const charges = Array.isArray(body.charges)
      ? (body.charges as { id?: string }[])
      : [];
    const candidate =
      (typeof body.id === "string" &&
      (body.id.startsWith("ORDE_") || body.id.startsWith("CHAR_"))
        ? body.id
        : null) ?? charges.find((c) => c.id?.startsWith("CHAR_"))?.id;
    if (!candidate) return NextResponse.json({ received: true });

    const status = await getPaymentStatus(candidate);
    if (!status?.paid || !status.referenceId) {
      return NextResponse.json({ received: true });
    }

    const order = await prisma.order.findUnique({
      where: { number: status.referenceId },
    });
    if (order) {
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        // Guarda o id da COBRANÇA paga — é ele que o reembolso usa.
        data: { externalId: status.paidChargeId ?? candidate },
      });
      await fulfillOrder(order.id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook pagbank]", err);
    return NextResponse.json({ received: true });
  }
}
