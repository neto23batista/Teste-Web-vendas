import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { prisma } from "@/lib/prisma";
import { fulfillOrder } from "@/lib/orders";
import { mpConfigured } from "@/lib/mercadopago";

/**
 * Valida a assinatura do webhook (HMAC-SHA256) conforme o Mercado Pago.
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 * Se MERCADO_PAGO_WEBHOOK_SECRET não estiver setado, não bloqueia (a verificação
 * por re-busca do pagamento na API já protege contra forja) — mas em produção
 * o segredo DEVE ser configurado.
 */
function validSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const sig = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!sig) return false;

  const parts = Object.fromEntries(
    sig.split(",").map((p) => p.split("=").map((s) => s.trim()))
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const type = body?.type ?? req.nextUrl.searchParams.get("type");
    const paymentId = body?.data?.id ?? req.nextUrl.searchParams.get("data.id");

    if (type !== "payment" || !paymentId || !mpConfigured()) {
      return NextResponse.json({ received: true });
    }

    if (!validSignature(req, String(paymentId))) {
      return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
    });
    const payment = await new Payment(client).get({ id: String(paymentId) });

    const orderNumber = payment.external_reference;
    if (payment.status === "approved" && orderNumber) {
      const order = await prisma.order.findUnique({
        where: { number: orderNumber },
      });
      if (order) {
        await prisma.payment.updateMany({
          where: { orderId: order.id },
          data: { externalId: String(paymentId) },
        });
        await fulfillOrder(order.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook mercadopago]", err);
    return NextResponse.json({ received: true });
  }
}
