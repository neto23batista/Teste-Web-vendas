import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { fulfillOrder } from "@/lib/orders";
import { getStripeForWebhook } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Stripe. Segurança por ASSINATURA: o corpo CRU é validado com o
 * webhook secret via `constructEvent` — payload forjado é rejeitado (400). Em
 * `payment_intent.succeeded` (PIX/cartão) e `checkout.session.completed` (cartão),
 * grava o id do PaymentIntent (para reembolso) e confirma o pedido (fulfillOrder).
 */
export async function POST(req: NextRequest) {
  const cfg = await getStripeForWebhook();
  if (!cfg) return NextResponse.json({ received: true });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "sem assinatura" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = cfg.client.webhooks.constructEvent(raw, sig, cfg.webhookSecret);
  } catch (err) {
    console.error("[webhook stripe] assinatura inválida:", err);
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  try {
    let orderNumber: string | null = null;
    let paymentIntentId: string | null = null;

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      orderNumber = pi.metadata?.orderNumber ?? null;
      paymentIntentId = pi.id;
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }
      orderNumber = session.metadata?.orderNumber ?? null;
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
    } else {
      return NextResponse.json({ received: true });
    }

    if (orderNumber) {
      const order = await prisma.order.findUnique({ where: { number: orderNumber } });
      if (order) {
        if (paymentIntentId) {
          await prisma.payment.updateMany({
            where: { orderId: order.id },
            data: { externalId: paymentIntentId },
          });
        }
        await fulfillOrder(order.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Erro interno nosso: responde 200 para o Stripe não re-tentar em loop.
    console.error("[webhook stripe]", err);
    return NextResponse.json({ received: true });
  }
}
