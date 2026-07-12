/**
 * Integração Stripe — provedor de pagamento (substitui o PagBank).
 *
 * - PIX nativo: PaymentIntent com método `pix` → QR + copia-e-cola exibidos na
 *   página do pedido, sem sair do site. O webhook confirma a aprovação.
 *   (Pix no Stripe para empresas BR é liberado por convite — sem habilitação, a
 *   criação falha e o checkout cai em "aguardando pagamento".)
 * - Cartão: Checkout Session hospedada (redirect); o cliente volta pela success_url.
 * - Reembolso: refunds.create({ payment_intent }) no cancelamento de pedido pago.
 *
 * Credenciais: a secret key salva em /admin/configuracoes (tabela Setting) tem
 * prioridade; sem ela, vale a env STRIPE_SECRET_KEY — ver getPaymentSettings().
 * Tudo é best-effort: sem chave ou com falha na API, as funções retornam
 * null/false e o checkout cai no fluxo de "aguardando pagamento".
 * Valores monetários na API são em CENTAVOS (inteiro), moeda BRL.
 */

import Stripe from "stripe";
import { getPaymentSettings } from "@/lib/settings";
import { qrPngBase64 } from "@/lib/qrcode";

const toCents = (v: number) => Math.round(v * 100);

async function getClient(): Promise<Stripe | null> {
  const { stripeSecretKey } = await getPaymentSettings();
  return stripeSecretKey ? new Stripe(stripeSecretKey) : null;
}

export async function stripeConfigured(): Promise<boolean> {
  const { stripeSecretKey } = await getPaymentSettings();
  return !!stripeSecretKey;
}

/** Cliente + segredo do webhook, para a rota /api/webhooks/stripe. */
export async function getStripeForWebhook(): Promise<{
  client: Stripe;
  webhookSecret: string;
} | null> {
  const { stripeSecretKey, stripeWebhookSecret } = await getPaymentSettings();
  if (!stripeSecretKey || !stripeWebhookSecret) return null;
  return { client: new Stripe(stripeSecretKey), webhookSecret: stripeWebhookSecret };
}

export type StripePing = {
  configured: boolean;
  /** true = a secret key autentica na API do Stripe. */
  ok: boolean;
  /** true = chave de produção (sk_live_…); false = teste (sk_test_…). */
  live: boolean;
  status: number;
};

/** Testa se a secret key salva autentica (retrieve do balance) e o ambiente. */
export async function stripePing(): Promise<StripePing> {
  const { stripeSecretKey } = await getPaymentSettings();
  if (!stripeSecretKey) return { configured: false, ok: false, live: false, status: 0 };
  const live = stripeSecretKey.startsWith("sk_live_");
  try {
    await new Stripe(stripeSecretKey).balance.retrieve();
    return { configured: true, ok: true, live, status: 200 };
  } catch (err) {
    const status = (err as Stripe.errors.StripeError)?.statusCode ?? 0;
    return { configured: true, ok: false, live, status };
  }
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

/**
 * Cria um PaymentIntent PIX e devolve o QR/copia-e-cola. A imagem PNG do QR é
 * gerada localmente a partir do EMV (não depende de baixar imagem do provedor).
 * Retorna null se não configurado, sem Pix habilitado, ou se a API recusar.
 */
export async function createPixPayment(opts: {
  orderNumber: string;
  amount: number;
  payerEmail: string;
  payerName?: string | null;
  payerTaxId?: string | null; // CPF (coletado no checkout)
  description?: string;
}): Promise<PixCharge | null> {
  const client = await getClient();
  if (!client || opts.amount <= 0 || !opts.payerEmail) return null;

  try {
    const pi = await client.paymentIntents.create(
      {
        amount: toCents(opts.amount),
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
    console.error("[stripe] falha ao criar pix:", err);
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

type CheckoutItem = { name: string; price: number; qty: number };

/**
 * Cria uma Checkout Session (página hospedada do Stripe) para cartão e devolve a
 * URL de pagamento. O cliente é redirecionado e volta para a página do pedido.
 */
export async function createHostedCheckout(opts: {
  orderNumber: string;
  items: CheckoutItem[];
  shipping: number;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const session = await client.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          ...opts.items.map((i) => ({
            quantity: i.qty,
            price_data: {
              currency: "brl",
              unit_amount: toCents(i.price),
              product_data: { name: i.name.slice(0, 250) },
            },
          })),
          ...(opts.shipping > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: "brl",
                    unit_amount: toCents(opts.shipping),
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
    return session.url ?? null;
  } catch (err) {
    console.error("[stripe] falha ao criar checkout:", err);
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
    console.error(`[stripe] falha ao consultar ${paymentIntentId}:`, err);
    return null;
  }
}

/**
 * Estorna um pagamento aprovado (reembolso total). Aceita o id do PaymentIntent
 * (pi_…). Best-effort: nunca lança — falha aqui não bloqueia o cancelamento.
 */
export async function refundPayment(paymentIntentId: string): Promise<boolean> {
  const client = await getClient();
  if (!client || !paymentIntentId) return false;
  try {
    await client.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-${paymentIntentId}` }
    );
    return true;
  } catch (err) {
    console.error(`[stripe] erro ao reembolsar ${paymentIntentId}:`, err);
    return false;
  }
}
