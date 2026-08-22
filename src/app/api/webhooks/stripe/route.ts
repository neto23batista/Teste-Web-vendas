import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  confirmStripePayment,
  failStripePayment,
  recordStripeRefund,
} from "@/lib/orders";
import { getStripeForWebhook } from "@/lib/stripe";
import { reportError } from "@/lib/monitoring";
import { moneyToCents } from "@/lib/money";
import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  readTextBodyLimited,
  RequestBodyTooLargeError,
} from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let reportedMissingConfiguration = false;

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
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "sem assinatura" }, { status: 400 });

  const cfg = await getStripeForWebhook();
  if (!cfg) {
    if (!reportedMissingConfiguration) {
      reportedMissingConfiguration = true;
      reportError(new Error("Webhook Stripe indisponível por configuração ausente."), {
        operation: "stripe.webhook.config",
      });
    }
    return NextResponse.json(
      { error: "webhook temporariamente indisponível" },
      { status: 503 }
    );
  }

  let event: Stripe.Event;
  try {
    const raw = await readTextBodyLimited(req, DEFAULT_MAX_REQUEST_BODY_BYTES);
    event = cfg.client.webhooks.constructEvent(raw, sig, cfg.webhookSecret);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: "corpo da requisição muito grande" },
        { status: 413 }
      );
    }
    reportError(err, {
      operation: "stripe.webhook.verify_signature",
    });
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  try {
    if (
      event.type === "refund.created" ||
      event.type === "refund.updated" ||
      event.type === "refund.failed"
    ) {
      const refund = event.data.object as Stripe.Refund;
      const paymentIntentId =
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : (refund.payment_intent?.id ?? null);
      await recordStripeRefund({
        refundId: refund.id,
        paymentIntentId,
        status: refund.status,
        amountCents: refund.amount,
        error: refund.failure_reason ?? null,
      });
      return NextResponse.json({ received: true });
    }

    let orderNumber: string | null = null;
    let paymentIntentId: string | null = null;
    let paidCents: number | null = null;
    let currency: string | null = null;
    let failureReason: string | null = null;

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
    } else if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.canceled"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      orderNumber = pi.metadata?.orderNumber ?? null;
      paymentIntentId = pi.id;
      failureReason =
        event.type === "payment_intent.canceled"
          ? "Pagamento cancelado no Stripe."
          : pi.last_payment_error?.message || "Pagamento recusado pelo Stripe.";
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      orderNumber = session.metadata?.orderNumber ?? null;
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      failureReason =
        event.type === "checkout.session.expired"
          ? "Sessão de pagamento expirada."
          : "Pagamento assíncrono recusado pelo Stripe.";
    } else {
      return NextResponse.json({ received: true });
    }

    if (!orderNumber) return NextResponse.json({ received: true });

    const order = await prisma.order.findUnique({ where: { number: orderNumber } });
    if (!order) return NextResponse.json({ received: true });

    if (failureReason) {
      await failStripePayment(order.id, paymentIntentId, failureReason);
      return NextResponse.json({ received: true });
    }

    // O valor pago precisa bater com o total do pedido. Sem esta trava, um
    // PaymentIntent de R$ 0,50 carregando o número do pedido confirmaria uma
    // compra de R$ 500 — e qualquer divergência futura entre o que cobramos e o
    // que o pedido registra passaria batido.
    const expectedCents = moneyToCents(order.total);
    if (expectedCents === null) {
      reportError(new Error("Total autoritativo do pedido é inválido."), {
        operation: "stripe.webhook.invalid_order_total",
        eventType: event.type,
      });
      return NextResponse.json({ error: "total do pedido inválido" }, { status: 500 });
    }
    if (paidCents !== expectedCents || currency?.toLowerCase() !== "brl") {
      reportError(new Error("Valor recebido diverge do total autoritativo."), {
        operation: "stripe.webhook.amount_mismatch",
        eventType: event.type,
        paidCents: String(paidCents),
        expectedCents: String(expectedCents),
        currency: currency ?? undefined,
      });
      return NextResponse.json({ received: true, mismatch: true });
    }

    if (!paymentIntentId) {
      reportError(new Error("Pagamento confirmado sem PaymentIntent."), {
        operation: "stripe.webhook.missing_payment_intent",
        eventType: event.type,
      });
      return NextResponse.json({ error: "PaymentIntent ausente" }, { status: 500 });
    }
    await confirmStripePayment(order.id, paymentIntentId);

    return NextResponse.json({ received: true });
  } catch (err) {
    // Falha nossa (banco fora, estoque insuficiente): devolve 500 para o Stripe
    // RE-TENTAR — senão o cliente pagava e o pedido ficava preso em "pendente".
    // Seguro porque fulfillOrder só age uma vez (reivindicação atômica).
    reportError(err, {
      operation: "stripe.webhook.process",
      eventType: event.type,
    });
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
