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
 *
 * Antes de confirmar, CONFERE O VALOR PAGO contra o total do pedido: um pedido só
 * é confirmado se o dinheiro que entrou for o dinheiro cobrado (em BRL). Um mesmo
 * pagamento de cartão chega aqui duas vezes (session + intent) e a entrega é
 * "pelo menos uma vez" — `fulfillOrder` é idempotente (reivindicação atômica).
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
    let paidCents: number | null = null;
    let currency: string | null = null;

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      orderNumber = pi.metadata?.orderNumber ?? null;
      paymentIntentId = pi.id;
      paidCents = pi.amount_received;
      currency = pi.currency;
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
      paidCents = session.amount_total;
      currency = session.currency;
    } else {
      return NextResponse.json({ received: true });
    }

    if (!orderNumber) return NextResponse.json({ received: true });

    const order = await prisma.order.findUnique({ where: { number: orderNumber } });
    if (!order) return NextResponse.json({ received: true });

    // O valor pago precisa bater com o total do pedido. Sem esta trava, um
    // PaymentIntent de R$ 0,50 carregando o número do pedido confirmaria uma
    // compra de R$ 500 — e qualquer divergência futura entre o que cobramos e o
    // que o pedido registra passaria batido.
    const expectedCents = Math.round(order.total * 100);
    if (paidCents !== expectedCents || currency?.toLowerCase() !== "brl") {
      console.error(
        `[webhook stripe] valor divergente no pedido ${orderNumber}: ` +
          `pago ${paidCents} ${currency}, esperado ${expectedCents} brl — não confirmado.`
      );
      return NextResponse.json({ received: true, mismatch: true });
    }

    if (paymentIntentId) {
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { externalId: paymentIntentId },
      });
    }
    await fulfillOrder(order.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    // Falha nossa (banco fora, estoque insuficiente): devolve 500 para o Stripe
    // RE-TENTAR — senão o cliente pagava e o pedido ficava preso em "pendente".
    // Seguro porque fulfillOrder só age uma vez (reivindicação atômica).
    console.error("[webhook stripe]", err);
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
