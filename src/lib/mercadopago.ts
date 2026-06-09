import { MercadoPagoConfig, Preference } from "mercadopago";

export function mpConfigured(): boolean {
  return !!process.env.MERCADO_PAGO_ACCESS_TOKEN;
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
