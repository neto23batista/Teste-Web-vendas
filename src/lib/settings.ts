import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIPPING_CONFIG, type ShippingConfig } from "@/lib/shipping";
import { moneyToNumber } from "@/lib/money";

// Configurações da loja (tabela Setting, chave/valor). Lidas de uma vez e
// cacheadas sob a tag "settings" — salvar em /admin/configuracoes revalida.
const getRawSettings = unstable_cache(
  async () => {
    const rows = await prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<
      string,
      string
    >;
  },
  ["settings"],
  { tags: ["settings"], revalidate: 3600 }
);

/** Termos padrão de troca e devolução (CDC art. 49 — direito de arrependimento). */
export const DEFAULT_RETURN_POLICY = `## Política de Troca e Devolução

Esta política segue o Código de Defesa do Consumidor (Lei nº 8.078/1990).

### Direito de arrependimento (compras online)
Você pode desistir da compra em até **7 (sete) dias corridos** a partir do recebimento do produto, sem necessidade de justificativa (art. 49 do CDC). O valor pago, incluindo o frete, é devolvido integralmente.

### Troca por defeito
Produtos com defeito de fabricação podem ser trocados em até **30 dias** (não duráveis) ou **90 dias** (duráveis) após o recebimento.

### Condições
- O produto deve estar em sua embalagem original, sem indícios de uso e com o lacre intacto.
- Medicamentos, produtos de higiene pessoal e itens termossensíveis só são aceitos para troca/devolução se **não violados**, por razões sanitárias (RDC Anvisa).
- Guarde a nota fiscal — ela é necessária para a troca ou devolução.

### Como solicitar
Entre em contato pelo WhatsApp ou e-mail de atendimento informando o número do pedido. Nossa equipe orienta a coleta ou o envio do produto e processa o reembolso na mesma forma de pagamento em até 10 dias úteis após o recebimento do item.`;

export type StoreSettings = {
  shipping: ShippingConfig;
  returnPolicy: string;
  legalName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  pharmacistName: string;
  pharmacistCrf: string;
  sanitaryLicense: string;
  afe: string;
  ae: string;
};

function num(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  // Sem banco (ex.: build na Vercel) caímos nos padrões — nada quebra.
  const s = await getRawSettings().catch(
    () => ({}) as Record<string, string>
  );
  return {
    shipping: {
      freeMin: num(s["shipping.freeMin"], DEFAULT_SHIPPING_CONFIG.freeMin),
      freeRadiusKm: num(s["shipping.freeRadiusKm"], DEFAULT_SHIPPING_CONFIG.freeRadiusKm),
      perKm: num(s["shipping.perKm"], DEFAULT_SHIPPING_CONFIG.perKm),
      expressFlat: num(s["shipping.expressFlat"], DEFAULT_SHIPPING_CONFIG.expressFlat),
      defaultKm: num(s["shipping.defaultKm"], DEFAULT_SHIPPING_CONFIG.defaultKm),
    },
    returnPolicy: s["store.returnPolicy"] || DEFAULT_RETURN_POLICY,
    legalName: s["store.legalName"] || "",
    cnpj: s["store.cnpj"] || process.env.NEXT_PUBLIC_CNPJ || "",
    phone: s["store.phone"] || "",
    whatsapp: s["store.whatsapp"] || "",
    email: s["store.email"] || "",
    address: s["store.address"] || "",
    hours: s["store.hours"] || "",
    pharmacistName:
      s["store.pharmacistName"] || process.env.NEXT_PUBLIC_PHARMACIST_NAME || "",
    pharmacistCrf:
      s["store.pharmacistCrf"] || process.env.NEXT_PUBLIC_PHARMACIST_CRF || "",
    sanitaryLicense: s["store.sanitaryLicense"] || "",
    afe: s["store.afe"] || "",
    ae: s["store.ae"] || "",
  };
}

export type PaymentSettings = {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  /** true = chave de produção (sk_live_…); derivado da própria chave. */
  stripeLive: boolean;
  /**
   * true = a conta Stripe tem o Pix ATIVO. Gravado pelo "Testar conexão"
   * (`stripe.pixEnabled`), que consulta a capability na API. Fica em cache aqui
   * porque o checkout precisa saber isso a cada renderização — não dá para bater
   * na API do Stripe toda vez. Padrão FALSE: enquanto não houver confirmação, o
   * PIX não é oferecido (melhor esconder do que dar um QR que nunca vem).
   */
  stripePixEnabled: boolean;
};

/**
 * Credenciais de pagamento (Stripe). Segredos vêm exclusivamente do ambiente/
 * secret manager; nunca são persistidos na tabela genérica Setting.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const s = await getRawSettings().catch(
    () => ({}) as Record<string, string>
  );
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  return {
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
    stripeLive: secretKey.startsWith("sk_live_"),
    stripePixEnabled: (s["stripe.pixEnabled"] ?? "") === "1",
  };
}

export type RegulatoryInfo = {
  legalName: string;
  cnpj: string;
  pharmacistName: string;
  pharmacistCrf: string;
  sanitaryLicense: string;
  afe: string;
  ae: string;
};

export type RegulatoryDisclosure = RegulatoryInfo & {
  address: string;
  hours: string;
  phone: string;
};

const REQUIRED_REGULATORY_FIELDS: {
  key: keyof RegulatoryDisclosure;
  label: string;
}[] = [
  { key: "legalName", label: "razão social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "address", label: "endereço completo" },
  { key: "hours", label: "horário de funcionamento" },
  { key: "phone", label: "telefone" },
  { key: "pharmacistName", label: "responsável técnico" },
  { key: "pharmacistCrf", label: "CRF" },
  { key: "sanitaryLicense", label: "licença sanitária" },
  { key: "afe", label: "AFE" },
];

/** Campos obrigatórios para a divulgação da operação remota (AE é condicional). */
export function missingRegulatoryDisclosure(
  disclosure: RegulatoryDisclosure
): string[] {
  return REQUIRED_REGULATORY_FIELDS.filter(
    ({ key }) => !disclosure[key].trim()
  ).map(({ label }) => label);
}

/**
 * Dados regulatórios (CNPJ + responsável técnico) da UNIDADE selecionada, com
 * fallback ao global de /admin/configuracoes. Cada campo vazio na unidade herda
 * o global. Resiliente: sem banco — ou antes da migration `pharmacy_regulatory`
 * — cai no global (o select das colunas novas falha e é capturado).
 */
export async function getRegulatoryInfo(
  pharmacyId?: string | null
): Promise<RegulatoryInfo> {
  const g = await getStoreSettings();
  const base: RegulatoryInfo = {
    legalName: g.legalName,
    cnpj: g.cnpj,
    pharmacistName: g.pharmacistName,
    pharmacistCrf: g.pharmacistCrf,
    sanitaryLicense: g.sanitaryLicense,
    afe: g.afe,
    ae: g.ae,
  };
  if (!pharmacyId) return base;
  const ph = await prisma.pharmacy
    .findUnique({
      where: { id: pharmacyId },
      select: { cnpj: true, pharmacistName: true, pharmacistCrf: true },
    })
    .catch(() => null);
  return {
    ...base,
    cnpj: ph?.cnpj?.trim() || base.cnpj,
    pharmacistName: ph?.pharmacistName?.trim() || base.pharmacistName,
    pharmacistCrf: ph?.pharmacistCrf?.trim() || base.pharmacistCrf,
  };
}

/**
 * Config de frete da UNIDADE que atende o pedido. Sem `pharmacyId` (ou unidade
 * sem override) devolve o frete global de /admin/configuracoes.
 * Resiliente: sem banco — ou antes da migration `pharmacy_shipping` — cai no
 * global (o select da coluna nova falha e é capturado).
 */
export async function getShippingConfig(
  pharmacyId?: string | null
): Promise<ShippingConfig> {
  const base = (await getStoreSettings()).shipping;
  if (!pharmacyId) return base;
  // Override por unidade: só o mínimo p/ frete grátis (coluna shippingFreeMin).
  const ph = await prisma.pharmacy
    .findUnique({
      where: { id: pharmacyId },
      select: { shippingFreeMin: true },
    })
    .catch(() => null);
  return {
    ...base,
    freeMin:
      ph?.shippingFreeMin == null
        ? base.freeMin
        : moneyToNumber(ph.shippingFreeMin),
  };
}

/**
 * Distância (km) do destino a partir das faixas de CEP da unidade
 * (PharmacyCepRange.km): acha a faixa que contém o CEP e devolve seu km.
 * Sem faixa casada retorna null: `defaultKm` só completa a distância de uma
 * faixa que a operação declarou como coberta, nunca cria cobertura implícita.
 * É a fonte da verdade da distância usada no frete server-side.
 */
export async function resolveKm(
  cep: string | null | undefined,
  pharmacyId?: string | null
): Promise<number | null> {
  const cfg = await getShippingConfig(pharmacyId);
  const digits = (cep ?? "").replace(/\D/g, "");
  if (digits.length !== 8 || !pharmacyId) return null;
  const n = parseInt(digits.slice(0, 8), 10);
  const range = await prisma.pharmacyCepRange
    .findFirst({
      where: {
        pharmacyId,
        archivedAt: null,
        start: { lte: n },
        end: { gte: n },
      },
      orderBy: { km: "asc" },
      select: { km: true },
    })
    .catch(() => null);
  return range ? (range.km ?? cfg.defaultKm) : null;
}
