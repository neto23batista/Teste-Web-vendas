/**
 * Integração PagBank (PagSeguro) — API Orders/Checkout/Charges.
 *
 * - PIX nativo: POST /orders com `qr_codes` → QR + copia-e-cola exibidos na
 *   página do pedido, sem sair do site. O webhook confirma a aprovação.
 * - Cartão (e demais): POST /checkouts → página de pagamento hospedada do
 *   PagBank (link "PAY"); o cliente volta pela `redirect_url`.
 * - Reembolso: POST /charges/{id}/cancel (total), no cancelamento de pedido pago.
 *
 * Credenciais: o token salvo em /admin/configuracoes (tabela Setting) tem
 * prioridade; sem ele, vale a env PAGBANK_TOKEN — ver getPaymentSettings().
 * Tudo é best-effort: sem token ou com falha na API, as funções retornam
 * null/false e o checkout cai no fluxo de "aguardando pagamento".
 * Valores monetários na API são em CENTAVOS (inteiro).
 */

import { getPaymentSettings } from "@/lib/settings";
import { qrPngBase64 } from "@/lib/qrcode";

const toCents = (v: number) => Math.round(v * 100);

type PagbankCfg = { token: string; sandbox: boolean };

async function getCfg(): Promise<PagbankCfg | null> {
  const { pagbankToken, pagbankSandbox } = await getPaymentSettings();
  return pagbankToken
    ? { token: pagbankToken, sandbox: pagbankSandbox }
    : null;
}

export async function pagbankConfigured(): Promise<boolean> {
  return !!(await getCfg());
}

function apiBase(cfg: PagbankCfg): string {
  return cfg.sandbox
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";
}

function authHeaders(cfg: PagbankCfg): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.token}`,
    "Content-Type": "application/json",
  };
}

function notifyUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/webhooks/pagbank`;
}

export type PixCharge = {
  /** id do pedido no PagBank (ORDE_...). */
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

type PagbankQrCode = {
  id?: string;
  text?: string;
  expiration_date?: string;
  links?: { rel?: string; href?: string; media?: string }[];
};

type PagbankCharge = {
  id?: string;
  status?: string;
  amount?: { value?: number };
};

type PagbankOrder = {
  id?: string;
  reference_id?: string;
  qr_codes?: PagbankQrCode[];
  charges?: PagbankCharge[];
};

/**
 * Cria um pedido PagBank com QR Code PIX. A imagem PNG do QR é baixada aqui
 * (server-side) e persistida em base64 — o front não fala com o PagBank.
 * Retorna null se não configurado ou se a API recusar (ex.: cliente sem CPF).
 */
export async function createPixPayment(opts: {
  orderNumber: string;
  amount: number;
  payerEmail: string;
  payerName?: string | null;
  payerTaxId?: string | null; // CPF (o PagBank exige para PIX)
  description?: string;
}): Promise<PixCharge | null> {
  const cfg = await getCfg();
  if (!cfg || opts.amount <= 0 || !opts.payerEmail) return null;

  try {
    // Sem expiração explícita: o QR segue a validade padrão do PagBank (24h).
    const res = await fetch(`${apiBase(cfg)}/orders`, {
      method: "POST",
      headers: {
        ...authHeaders(cfg),
        // Idempotência: reenvio do mesmo pedido não gera cobrança duplicada.
        "x-idempotency-key": `pix-${opts.orderNumber}`,
      },
      body: JSON.stringify({
        reference_id: opts.orderNumber,
        customer: {
          name: opts.payerName || "Cliente",
          email: opts.payerEmail,
          ...(opts.payerTaxId ? { tax_id: opts.payerTaxId } : {}),
        },
        items: [
          {
            name: opts.description ?? `Pedido ${opts.orderNumber}`,
            quantity: 1,
            unit_amount: toCents(opts.amount),
          },
        ],
        qr_codes: [{ amount: { value: toCents(opts.amount) } }],
        notification_urls: [notifyUrl()],
      }),
    });
    if (!res.ok) {
      console.error(
        `[pagbank] falha ao criar pix (${res.status}):`,
        await res.text().catch(() => "")
      );
      return null;
    }
    const order = (await res.json()) as PagbankOrder;
    const qr = order.qr_codes?.[0];
    if (!order.id || !qr?.text) return null;

    // Gera o QR a partir do copia-e-cola (não depende do PagBank devolver PNG).
    const qrCodeBase64 = await qrPngBase64(qr.text);

    return {
      paymentId: order.id,
      status: "pending",
      qrCode: qr.text,
      qrCodeBase64,
      ticketUrl: null,
      expiresAt: qr.expiration_date ?? null,
    };
  } catch (err) {
    console.error("[pagbank] falha ao criar pix:", err);
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
 * Cria um Checkout PagBank (página hospedada) e retorna a URL de pagamento
 * (link "PAY"). O cliente é redirecionado e volta para a página do pedido.
 */
export async function createHostedCheckout(opts: {
  orderNumber: string;
  items: CheckoutItem[];
  shipping: number;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<string | null> {
  const cfg = await getCfg();
  if (!cfg) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${apiBase(cfg)}/checkouts`, {
      method: "POST",
      headers: {
        ...authHeaders(cfg),
        "x-idempotency-key": `checkout-${opts.orderNumber}`,
      },
      body: JSON.stringify({
        reference_id: opts.orderNumber,
        ...(opts.customerEmail
          ? {
              customer: {
                name: opts.customerName || "Cliente",
                email: opts.customerEmail,
              },
            }
          : {}),
        items: [
          ...opts.items.map((i, idx) => ({
            reference_id: String(idx),
            name: i.name.slice(0, 100),
            quantity: i.qty,
            unit_amount: toCents(i.price),
          })),
          ...(opts.shipping > 0
            ? [
                {
                  reference_id: "frete",
                  name: "Frete",
                  quantity: 1,
                  unit_amount: toCents(opts.shipping),
                },
              ]
            : []),
        ],
        redirect_url: `${baseUrl}/pedido/${opts.orderNumber}`,
        notification_urls: [notifyUrl()],
        payment_notification_urls: [notifyUrl()],
      }),
    });
    if (!res.ok) {
      console.error(
        `[pagbank] falha ao criar checkout (${res.status}):`,
        await res.text().catch(() => "")
      );
      return null;
    }
    const data = (await res.json()) as {
      links?: { rel?: string; href?: string }[];
    };
    return data.links?.find((l) => l.rel === "PAY")?.href ?? null;
  } catch (err) {
    console.error("[pagbank] falha ao criar checkout:", err);
    return null;
  }
}

export type PagbankOrderStatus = {
  referenceId: string | null;
  paid: boolean;
  /** id da cobrança PAGA (CHAR_...) — usado para reembolso. */
  paidChargeId: string | null;
};

/**
 * Re-busca um pedido/cobrança na API (fonte da verdade). É assim que o webhook
 * valida a notificação — payload forjado não passa, pois o status vem da API.
 */
export async function getPaymentStatus(
  pagbankId: string
): Promise<PagbankOrderStatus | null> {
  const cfg = await getCfg();
  if (!cfg || !pagbankId) return null;
  try {
    if (pagbankId.startsWith("CHAR_")) {
      const res = await fetch(`${apiBase(cfg)}/charges/${pagbankId}`, {
        headers: authHeaders(cfg),
      });
      if (!res.ok) return null;
      const charge = (await res.json()) as PagbankCharge & {
        reference_id?: string;
      };
      const paid = charge.status === "PAID";
      return {
        referenceId: charge.reference_id ?? null,
        paid,
        paidChargeId: paid && charge.id ? charge.id : null,
      };
    }
    const res = await fetch(`${apiBase(cfg)}/orders/${pagbankId}`, {
      headers: authHeaders(cfg),
    });
    if (!res.ok) return null;
    const order = (await res.json()) as PagbankOrder;
    const paidCharge = order.charges?.find((c) => c.status === "PAID");
    return {
      referenceId: order.reference_id ?? null,
      paid: !!paidCharge,
      paidChargeId: paidCharge?.id ?? null,
    };
  } catch (err) {
    console.error(`[pagbank] falha ao consultar ${pagbankId}:`, err);
    return null;
  }
}

/**
 * Estorna uma cobrança aprovada (reembolso total). Aceita tanto o id da
 * cobrança (CHAR_...) quanto o do pedido (ORDE_... — resolve a cobrança paga).
 * Best-effort: nunca lança — falha aqui não bloqueia o cancelamento do pedido.
 */
export async function refundPayment(externalId: string): Promise<boolean> {
  const cfg = await getCfg();
  if (!cfg || !externalId) return false;

  try {
    let chargeId = externalId;
    let amountCents: number | null = null;

    if (externalId.startsWith("ORDE_")) {
      const status = await getPaymentStatus(externalId);
      if (!status?.paidChargeId) return false;
      chargeId = status.paidChargeId;
    }
    {
      const res = await fetch(`${apiBase(cfg)}/charges/${chargeId}`, {
        headers: authHeaders(cfg),
      });
      if (!res.ok) return false;
      const charge = (await res.json()) as PagbankCharge;
      amountCents = charge.amount?.value ?? null;
    }
    if (!amountCents) return false;

    const res = await fetch(`${apiBase(cfg)}/charges/${chargeId}/cancel`, {
      method: "POST",
      headers: {
        ...authHeaders(cfg),
        "x-idempotency-key": `refund-${chargeId}`,
      },
      body: JSON.stringify({ amount: { value: amountCents } }),
    });
    if (!res.ok) {
      console.error(
        `[pagbank] falha no reembolso ${chargeId}: ${res.status}`,
        await res.text().catch(() => "")
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[pagbank] erro ao reembolsar ${externalId}:`, err);
    return false;
  }
}
