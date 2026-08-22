/**
 * Integração Stripe — provedor de pagamentos online.
 *
 * - PIX nativo: PaymentIntent com método `pix` → QR + copia-e-cola exibidos na
 *   página do pedido, sem sair do site. O webhook confirma a aprovação.
 *   (Pix no Stripe para empresas BR é liberado por convite — sem habilitação, a
 *   criação falha e o checkout cai em "aguardando pagamento".)
 * - Cartão: Checkout Session hospedada (redirect); o cliente volta pela success_url.
 * - Reembolso: refunds.create({ payment_intent }) no cancelamento de pedido pago.
 *
 * Credenciais: exclusivamente STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET no
 * ambiente/secret manager — nunca na tabela genérica de configurações.
 * Tudo é best-effort: sem chave ou com falha na API, as funções retornam
 * null/false e o checkout cai no fluxo de "aguardando pagamento".
 * Valores monetários na API são em CENTAVOS (inteiro), moeda BRL.
 */

import Stripe from "stripe";
import { getPaymentSettings } from "@/lib/settings";
import { qrPngBase64 } from "@/lib/qrcode";
import { reportError } from "@/lib/monitoring";
import { moneyToCents, type MoneyValue } from "@/lib/money";

function toCents(value: MoneyValue): number {
  const cents = moneyToCents(value);
  if (cents === null) throw new TypeError("Valor monetário inválido para o Stripe.");
  return cents;
}

/** Política única de rede: retenta falhas transitórias sem prender o checkout. */
function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 10_000 });
}

async function getClient(): Promise<Stripe | null> {
  const { stripeSecretKey } = await getPaymentSettings();
  return stripeSecretKey ? stripeClient(stripeSecretKey) : null;
}

/** Cliente + segredo do webhook, para a rota /api/webhooks/stripe. */
export async function getStripeForWebhook(): Promise<{
  client: Stripe;
  webhookSecret: string;
} | null> {
  const { stripeSecretKey, stripeWebhookSecret } = await getPaymentSettings();
  if (!stripeSecretKey || !stripeWebhookSecret) return null;
  return { client: stripeClient(stripeSecretKey), webhookSecret: stripeWebhookSecret };
}

export type StripePing = {
  configured: boolean;
  /** true = a secret key autentica na API do Stripe. */
  ok: boolean;
  /** true = chave de produção (sk_live_…); false = teste (sk_test_…). */
  live: boolean;
  /** true = a conta tem o Pix ATIVO (habilitação por convite no Stripe BR). */
  pix: boolean;
  status: number;
};

/**
 * O Pix do Stripe para empresas BR é liberado por CONVITE — a conta pode ter uma
 * chave perfeitamente válida e ainda assim não conseguir cobrar por Pix. Quem diz
 * é a capability `pix_payments` da conta. Best-effort: qualquer falha vira `false`,
 * porque oferecer um meio de pagamento que não funciona deixa o pedido órfão
 * (cliente sem QR, sem como pagar) — o custo do falso-positivo é alto demais.
 */
async function pixCapability(client: Stripe): Promise<boolean> {
  try {
    // retrieveCurrent = a conta da própria secret key (não é uma conta Connect).
    const account = await client.accounts.retrieveCurrent();
    return account.capabilities?.pix_payments === "active";
  } catch {
    return false;
  }
}

/** Testa se a secret key salva autentica (retrieve do balance), o ambiente e o Pix. */
export async function stripePing(): Promise<StripePing> {
  const { stripeSecretKey } = await getPaymentSettings();
  if (!stripeSecretKey) {
    return { configured: false, ok: false, live: false, pix: false, status: 0 };
  }
  const live = stripeSecretKey.startsWith("sk_live_");
  const client = stripeClient(stripeSecretKey);
  try {
    await client.balance.retrieve();
  } catch (err) {
    const status = (err as Stripe.errors.StripeError)?.statusCode ?? 0;
    return { configured: true, ok: false, live, pix: false, status };
  }
  return { configured: true, ok: true, live, pix: await pixCapability(client), status: 200 };
}

export type PixCharge = {
  /** id do PaymentIntent no Stripe (pi_…). */
  paymentId: string;
  status: string;
  qrCode: string; // copia-e-cola (EMV)
  qrCodeBase64: string; // imagem PNG em base64 (sem o prefixo data:)
  ticketUrl: string | null;
  expiresAt: string | null;
};

/** Shape do PIX persistido em Payment.raw (para a página do pedido exibir). */
export type PixRaw = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string | null;
};

/** Referência da Checkout Session para o cliente retomar enquanto estiver aberta. */
export type CheckoutRaw = {
  sessionId: string;
  url: string | null;
  expiresAt: string | null;
};

/**
 * Cria um PaymentIntent PIX e devolve o QR/copia-e-cola. A imagem PNG do QR é
 * gerada localmente a partir do EMV (não depende de baixar imagem do provedor).
 * Retorna null se não configurado, sem Pix habilitado, ou se a API recusar.
 */
export async function createPixPayment(opts: {
  orderNumber: string;
  amount: MoneyValue;
  payerEmail: string;
  payerName?: string | null;
  payerTaxId?: string | null; // CPF (coletado no checkout)
  description?: string;
}): Promise<PixCharge | null> {
  const client = await getClient();
  const amountCents = toCents(opts.amount);
  if (!client || amountCents <= 0 || !opts.payerEmail) return null;

  try {
    const pi = await client.paymentIntents.create(
      {
        amount: amountCents,
        currency: "brl",
        payment_method_types: ["pix"],
        payment_method_data: {
          type: "pix",
          billing_details: {
            name: opts.payerName || "Cliente",
            email: opts.payerEmail,
          },
        },
        confirm: true,
        description: opts.description ?? `Pedido ${opts.orderNumber}`,
        receipt_email: opts.payerEmail,
        metadata: { orderNumber: opts.orderNumber },
        payment_method_options: { pix: { expires_after_seconds: 86400 } },
      },
      { idempotencyKey: `pix-${opts.orderNumber}` }
    );

    const qr = pi.next_action?.pix_display_qr_code;
    if (!qr?.data) return null;

    return {
      paymentId: pi.id,
      status: pi.status,
      qrCode: qr.data,
      qrCodeBase64: await qrPngBase64(qr.data),
      ticketUrl: qr.hosted_instructions_url ?? null,
      expiresAt: qr.expires_at ? new Date(qr.expires_at * 1000).toISOString() : null,
    };
  } catch (err) {
    reportError(err, { operation: "stripe.pix.create" });
    return null;
  }
}

/** Lê com segurança o PIX persistido em Payment.raw (Json). null se ausente. */
export function readPixRaw(raw: unknown): PixRaw | null {
  if (!raw || typeof raw !== "object") return null;
  const pix = (raw as Record<string, unknown>).pix;
  if (!pix || typeof pix !== "object") return null;
  const p = pix as Record<string, unknown>;
  if (typeof p.qrCode !== "string" || !p.qrCode) return null;
  return {
    qrCode: p.qrCode,
    qrCodeBase64: typeof p.qrCodeBase64 === "string" ? p.qrCodeBase64 : "",
    ticketUrl: typeof p.ticketUrl === "string" ? p.ticketUrl : null,
    expiresAt: typeof p.expiresAt === "string" ? p.expiresAt : null,
  };
}

export function readCheckoutRaw(raw: unknown): CheckoutRaw | null {
  if (!raw || typeof raw !== "object") return null;
  const checkout = (raw as Record<string, unknown>).checkout;
  if (!checkout || typeof checkout !== "object") return null;
  const value = checkout as Record<string, unknown>;
  if (typeof value.sessionId !== "string" || !value.sessionId) return null;
  return {
    sessionId: value.sessionId,
    url: typeof value.url === "string" ? value.url : null,
    expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : null,
  };
}

type CheckoutItem = { name: string; price: MoneyValue; qty: number };

/**
 * Quanto o cartão deve cobrar, em centavos, a partir do total AUTORITATIVO do
 * pedido (`order.total`). O Stripe não aceita item de linha negativo, então o
 * abatimento (cupom + resgate de pontos) vira um cupom de uso único.
 *
 * O desconto é DERIVADO do total — e não recalculado — de propósito: arredondar
 * itens, frete e desconto separadamente pode dar 1 centavo de diferença (ex.:
 * cupom percentual sobre frete fracionado), e aí o webhook, que confere o valor
 * pago, recusaria um pagamento legítimo e deixaria o pedido preso em "pendente".
 * Assim, cobrado === round(order.total * 100), centavo a centavo.
 */
export function hostedCheckoutAmounts(
  items: CheckoutItem[],
  shipping: MoneyValue,
  total: MoneyValue
): { itemsCents: number; shippingCents: number; discountCents: number; chargedCents: number } {
  const itemsCents = items.reduce((sum, i) => sum + toCents(i.price) * i.qty, 0);
  const shippingCents = toCents(shipping);
  const totalCents = toCents(total);
  // Nunca desconta mais que o subtotal dos itens (o frete sempre é cobrado) nem
  // menos que zero — as bordas são só rede de proteção; o normal cai no meio.
  const discountCents = Math.min(
    Math.max(0, itemsCents + shippingCents - totalCents),
    itemsCents
  );
  return {
    itemsCents,
    shippingCents,
    discountCents,
    chargedCents: itemsCents + shippingCents - discountCents,
  };
}

/**
 * Cria uma Checkout Session (página hospedada do Stripe) para cartão e devolve a
 * URL de pagamento. O cliente é redirecionado e volta para a página do pedido.
 *
 * `total` (order.total, já com cupom/pontos) é o valor cobrado — sem ele o Stripe
 * cobraria o preço cheio enquanto o pedido registra o total com desconto.
 */
export type HostedCheckout = {
  sessionId: string;
  url: string;
  expiresAt: string | null;
};

export async function createHostedCheckout(opts: {
  orderNumber: string;
  items: CheckoutItem[];
  shipping: MoneyValue;
  total: MoneyValue;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<HostedCheckout | null> {
  const client = await getClient();
  if (!client) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const { discountCents, shippingCents } = hostedCheckoutAmounts(
      opts.items,
      opts.shipping,
      opts.total
    );
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (discountCents > 0) {
      const coupon = await client.coupons.create(
        {
          amount_off: discountCents,
          currency: "brl",
          duration: "once",
          name: `Desconto ${opts.orderNumber}`,
        },
        { idempotencyKey: `coupon-${opts.orderNumber}` }
      );
      discounts = [{ coupon: coupon.id }];
    }

    const session = await client.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        ...(discounts ? { discounts } : {}),
        line_items: [
          ...opts.items.map((i) => ({
            quantity: i.qty,
            price_data: {
              currency: "brl",
              unit_amount: toCents(i.price),
              product_data: { name: i.name.slice(0, 250) },
            },
          })),
          ...(shippingCents > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: "brl",
                    unit_amount: shippingCents,
                    product_data: { name: "Frete" },
                  },
                },
              ]
            : []),
        ],
        ...(opts.customerEmail ? { customer_email: opts.customerEmail } : {}),
        metadata: { orderNumber: opts.orderNumber },
        // Propaga o número do pedido ao PaymentIntent — o webhook lê daqui.
        payment_intent_data: { metadata: { orderNumber: opts.orderNumber } },
        success_url: `${baseUrl}/pedido/${opts.orderNumber}`,
        cancel_url: `${baseUrl}/pedido/${opts.orderNumber}`,
      },
      { idempotencyKey: `checkout-${opts.orderNumber}` }
    );
    if (!session.url) return null;
    return {
      sessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    };
  } catch (err) {
    reportError(err, { operation: "stripe.checkout.create" });
    return null;
  }
}

export type PaymentOrderStatus = {
  referenceId: string | null;
  paid: boolean;
  /** id do PaymentIntent pago (pi_…) — usado para reembolso. */
  paidChargeId: string | null;
};

/** Re-consulta um PaymentIntent na API (fonte da verdade). */
export async function getPaymentStatus(
  paymentIntentId: string
): Promise<PaymentOrderStatus | null> {
  const client = await getClient();
  if (!client || !paymentIntentId) return null;
  try {
    const pi = await client.paymentIntents.retrieve(paymentIntentId);
    const paid = pi.status === "succeeded";
    return {
      referenceId: pi.metadata?.orderNumber ?? null,
      paid,
      paidChargeId: paid ? pi.id : null,
    };
  } catch (err) {
    reportError(err, { operation: "stripe.payment_intent.retrieve" });
    return null;
  }
}

/**
 * Resultado persistível de um pedido de reembolso. `pending` inclui casos em
 * que o Stripe exige ação ou ainda processa o estorno; o webhook conclui depois.
 */
export type RefundPaymentResult =
  | { ok: true; refundId: string; status: "succeeded" | "pending" }
  | { ok: false; refundId: string | null; error: string };

export async function refundPayment(
  paymentIntentId: string,
  orderNumber?: string
): Promise<RefundPaymentResult> {
  const client = await getClient();
  if (!client) {
    return { ok: false, refundId: null, error: "Stripe não configurado." };
  }
  if (!paymentIntentId) {
    return { ok: false, refundId: null, error: "PaymentIntent ausente." };
  }
  try {
    const refund = await client.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        ...(orderNumber ? { metadata: { orderNumber } } : {}),
      },
      { idempotencyKey: `refund-${paymentIntentId}` }
    );
    if (refund.status === "succeeded") {
      return { ok: true, refundId: refund.id, status: "succeeded" };
    }
    if (refund.status === "pending" || refund.status === "requires_action") {
      return { ok: true, refundId: refund.id, status: "pending" };
    }
    return {
      ok: false,
      refundId: refund.id,
      error: refund.failure_reason || `Reembolso retornou status ${refund.status ?? "desconhecido"}.`,
    };
  } catch (err) {
    reportError(err, { operation: "stripe.refund.create" });
    return {
      ok: false,
      refundId: null,
      error:
        err instanceof Error
          ? err.message
          : "Falha ao solicitar o reembolso no Stripe.",
    };
  }
}

/**
 * Invalida uma cobrança ainda não paga. É best-effort: o webhook continua
 * sendo a rede de segurança caso o pagamento vença a corrida do cancelamento.
 */
export async function cancelPendingStripePayment(input: {
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
}): Promise<boolean> {
  const client = await getClient();
  if (!client) return false;

  let attempted = false;
  let ok = true;
  if (input.paymentIntentId) {
    attempted = true;
    try {
      const intent = await client.paymentIntents.retrieve(input.paymentIntentId);
      if (
        intent.status !== "succeeded" &&
        intent.status !== "canceled" &&
        intent.status !== "processing"
      ) {
        await client.paymentIntents.cancel(input.paymentIntentId);
      }
    } catch (err) {
      ok = false;
      reportError(err, { operation: "stripe.payment_intent.cancel" });
    }
  }
  if (input.checkoutSessionId) {
    attempted = true;
    try {
      const session = await client.checkout.sessions.retrieve(input.checkoutSessionId);
      if (session.status === "open") {
        await client.checkout.sessions.expire(input.checkoutSessionId);
      }
    } catch (err) {
      ok = false;
      reportError(err, { operation: "stripe.checkout.expire" });
    }
  }
  return attempted && ok;
}
