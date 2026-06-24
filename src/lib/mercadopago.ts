import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

export function mpConfigured(): boolean {
  return !!process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

export type PixCharge = {
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
 * Cria uma cobrança PIX nativa (QR + copia-e-cola) via Payments API, sem sair
 * do site. O webhook confirma a aprovação. Retorna null se o MP não estiver
 * configurado ou a API falhar (o checkout cai no fluxo de "aguardando").
 */
export async function createPixPayment(opts: {
  orderNumber: string;
  amount: number;
  payerEmail: string;
  payerName?: string | null;
  description?: string;
}): Promise<PixCharge | null> {
  if (!mpConfigured() || opts.amount <= 0 || !opts.payerEmail) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  });

  try {
    const res = await new Payment(client).create({
      body: {
        transaction_amount: Number(opts.amount.toFixed(2)),
        description: opts.description ?? `Pedido ${opts.orderNumber}`,
        payment_method_id: "pix",
        external_reference: opts.orderNumber,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        payer: {
          email: opts.payerEmail,
          first_name: opts.payerName ?? undefined,
        },
      },
      // Idempotência: reenvio do mesmo pedido não gera cobrança duplicada.
      requestOptions: { idempotencyKey: `pix-${opts.orderNumber}` },
    });

    const tx = res.point_of_interaction?.transaction_data;
    if (!tx?.qr_code) return null;
    return {
      paymentId: String(res.id),
      status: res.status ?? "pending",
      qrCode: tx.qr_code,
      qrCodeBase64: tx.qr_code_base64 ?? "",
      ticketUrl: tx.ticket_url ?? null,
      expiresAt: res.date_of_expiration ?? null,
    };
  } catch (err) {
    console.error("[mercadopago] falha ao criar pix:", err);
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

type PrefItem = { name: string; price: number; qty: number };

/**
 * Cria uma preferência de pagamento (Checkout Pro) e retorna a URL de pagamento.
 * Só funciona com um Access Token válido configurado.
 */
export async function createPreference(opts: {
  orderNumber: string;
  items: PrefItem[];
  shipping: number;
}): Promise<string | null> {
  if (!mpConfigured()) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  });
  const preference = new Preference(client);

  try {
    const result = await preference.create({
      body: {
        items: [
          ...opts.items.map((i, idx) => ({
            id: String(idx),
            title: i.name,
            quantity: i.qty,
            unit_price: Number(i.price.toFixed(2)),
            currency_id: "BRL",
          })),
          ...(opts.shipping > 0
            ? [
                {
                  id: "shipping",
                  title: "Frete",
                  quantity: 1,
                  unit_price: Number(opts.shipping.toFixed(2)),
                  currency_id: "BRL",
                },
              ]
            : []),
        ],
        external_reference: opts.orderNumber,
        back_urls: {
          success: `${baseUrl}/pedido/${opts.orderNumber}`,
          failure: `${baseUrl}/pedido/${opts.orderNumber}`,
          pending: `${baseUrl}/pedido/${opts.orderNumber}`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });
    return result.init_point ?? null;
  } catch (err) {
    console.error("[mercadopago] falha ao criar preferência:", err);
    return null;
  }
}

/**
 * Estorna um pagamento aprovado (reembolso total) via API do Mercado Pago.
 * Best-effort: retorna true/false e nunca lança — uma falha aqui não deve
 * bloquear o cancelamento do pedido (estoque/pontos já foram revertidos).
 * `externalId` é o id do pagamento no MP (Payment.externalId).
 */
export async function refundPayment(externalId: string): Promise<boolean> {
  if (!mpConfigured() || !externalId) return false;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${externalId}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN!}`,
          "Content-Type": "application/json",
          // Idempotência: reembolsos repetidos com a mesma chave não duplicam.
          "X-Idempotency-Key": `refund-${externalId}`,
        },
        // Corpo vazio = reembolso total do pagamento.
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[mercadopago] falha no reembolso ${externalId}: ${res.status} ${text}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[mercadopago] erro ao reembolsar ${externalId}:`, err);
    return false;
  }
}
