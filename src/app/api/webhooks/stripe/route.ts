import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  confirmStripePayment,
  failStripePayment,
  quarantinePayment,
  recordStripeRefund,
} from "@/lib/orders";
import { getStripeForWebhook } from "@/lib/payments/stripe";
import { recordStripeReturnRefund } from "@/lib/payments/return-refunds";
import { reportError } from "@/lib/monitoring";
import { moneyToCents } from "@/lib/money";
import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  readTextBodyLimited,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let reportedMissingConfiguration = false;

class StripeEventPayloadMismatch extends Error {}

async function claimStripeEvent(event: Stripe.Event, payloadSha256: string) {
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type, payloadSha256 },
    });
    return "claimed" as const;
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
  }

  const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (!existing) throw new Error("Evento Stripe desapareceu após conflito de chave.");
  if (existing.payloadSha256 !== payloadSha256) {
    throw new StripeEventPayloadMismatch("O mesmo id de evento chegou com outro payload.");
  }
  if (existing.status === "PROCESSED") return "processed" as const;

  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const claimed = await prisma.stripeEvent.updateMany({
    where: {
      id: event.id,
      OR: [{ status: "FAILED" }, { status: "PROCESSING", updatedAt: { lt: staleBefore } }],
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  return claimed.count === 1 ? ("claimed" as const) : ("processing" as const);
}

async function completeStripeEvent(eventId: string) {
  await prisma.stripeEvent.updateMany({
    where: { id: eventId, status: "PROCESSING" },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });
}

async function failStripeEvent(eventId: string, error: unknown) {
  await prisma.stripeEvent.updateMany({
    where: { id: eventId, status: "PROCESSING" },
    data: {
      status: "FAILED",
      lastError: (error instanceof Error ? error.message : "Falha desconhecida.").slice(0, 2000),
    },
  });
}

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
  let raw: string;
  try {
    raw = await readTextBodyLimited(req, DEFAULT_MAX_REQUEST_BODY_BYTES);
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
    const payloadSha256 = createHash("sha256").update(raw).digest("hex");
    const claim = await claimStripeEvent(event, payloadSha256);
    if (claim === "processed") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claim === "processing") {
      // Força nova tentativa: responder 2xx aqui poderia deixar o evento preso
      // se a primeira execução tivesse morrido depois do claim.
      return NextResponse.json({ error: "evento em processamento" }, { status: 503 });
    }
  } catch (error) {
    reportError(error, { operation: "stripe.webhook.claim", eventType: event.type });
    return NextResponse.json(
      { error: error instanceof StripeEventPayloadMismatch ? "evento divergente" : "falha ao registrar evento" },
      { status: error instanceof StripeEventPayloadMismatch ? 409 : 500 }
    );
  }

  const done = async (body: Record<string, unknown> = { received: true }, status = 200) => {
    await completeStripeEvent(event.id);
    return NextResponse.json(body, { status });
  };

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
      const returnId = refund.metadata?.returnId ?? null;
      if (returnId) {
        await recordStripeReturnRefund({
          refundId: refund.id,
          returnId,
          status: refund.status,
          amountCents: refund.amount,
          error: refund.failure_reason ?? null,
        });
      } else {
        await recordStripeRefund({
          refundId: refund.id,
          paymentIntentId,
          status: refund.status,
          amountCents: refund.amount,
          error: refund.failure_reason ?? null,
        });
      }
      return done();
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
        return done();
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
      return done();
    }

    if (!orderNumber) return done();

    const order = await prisma.order.findUnique({ where: { number: orderNumber } });
    if (!order) return done();

    if (failureReason) {
      await failStripePayment(order.id, paymentIntentId, failureReason);
      return done();
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
      throw new Error("Total autoritativo do pedido é inválido.");
    }
    if (paidCents !== expectedCents || currency?.toLowerCase() !== "brl") {
      // Recusar a confirmação é correto, mas antes era só isso: o evento era
      // concluído, o Payment continuava PENDING sem PaymentIntent e o valor
      // ficava retido no Stripe sem vínculo nenhum aqui — até o cron de reservas
      // expirar o pedido e devolver o estoque. A quarentena guarda o
      // PaymentIntent, tira a cobrança de todo automatismo e a coloca na fila de
      // conciliação do financeiro.
      await quarantinePayment({
        orderId: order.id,
        paymentIntentId,
        paidCents,
        expectedCents,
        currency,
      });
      reportError(new Error("Valor recebido diverge do total autoritativo."), {
        operation: "stripe.webhook.amount_mismatch",
        eventType: event.type,
        paidCents: String(paidCents),
        expectedCents: String(expectedCents),
        currency: currency ?? undefined,
      });
      // Conclui o evento de propósito: o Stripe não deve reentregar para sempre
      // um caso que agora tem dono aqui dentro.
      return done({ received: true, quarantined: true });
    }

    if (!paymentIntentId) {
      reportError(new Error("Pagamento confirmado sem PaymentIntent."), {
        operation: "stripe.webhook.missing_payment_intent",
        eventType: event.type,
      });
      throw new Error("Pagamento confirmado sem PaymentIntent.");
    }
    await confirmStripePayment(order.id, paymentIntentId);

    return done();
  } catch (err) {
    // Falha nossa (banco fora, estoque insuficiente): devolve 500 para o Stripe
    // RE-TENTAR — senão o cliente pagava e o pedido ficava preso em "pendente".
    // Seguro porque fulfillOrder só age uma vez (reivindicação atômica).
    reportError(err, {
      operation: "stripe.webhook.process",
      eventType: event.type,
    });
    try {
      await failStripeEvent(event.id, err);
    } catch (inboxError) {
      reportError(inboxError, { operation: "stripe.webhook.mark_failed", eventType: event.type });
    }
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
