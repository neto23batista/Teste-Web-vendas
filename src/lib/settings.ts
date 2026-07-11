import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIPPING_CONFIG, type ShippingConfig } from "@/lib/shipping";

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
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  pharmacistName: string;
  pharmacistCrf: string;
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
    cnpj: s["store.cnpj"] || process.env.NEXT_PUBLIC_CNPJ || "",
    phone: s["store.phone"] || "",
    whatsapp: s["store.whatsapp"] || "",
    email: s["store.email"] || "",
    address: s["store.address"] || "",
    hours: s["store.hours"] || "",
    pharmacistName:
      s["store.pharmacistName"] ||
      process.env.NEXT_PUBLIC_PHARMACIST_NAME ||
      "Responsável Técnico(a) a definir",
    pharmacistCrf:
      s["store.pharmacistCrf"] ||
      process.env.NEXT_PUBLIC_PHARMACIST_CRF ||
      "CRF/UF 00000",
  };
}

export type PaymentSettings = {
  pagbankToken: string;
  pagbankSandbox: boolean;
};

/**
 * Credenciais de pagamento (PagBank). O token salvo em /admin/configuracoes
 * tem prioridade; sem ele, cai na variável de ambiente PAGBANK_TOKEN.
 * Propositalmente FORA de StoreSettings: só o servidor e a tela de
 * configurações do admin podem ver o token.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const s = await getRawSettings().catch(
    () => ({}) as Record<string, string>
  );
  const dbToken = (s["pagbank.token"] ?? "").trim();
  return {
    pagbankToken: dbToken || process.env.PAGBANK_TOKEN || "",
    pagbankSandbox:
      "pagbank.sandbox" in s
        ? s["pagbank.sandbox"] === "1"
        : process.env.PAGBANK_SANDBOX === "1",
  };
}

export type RegulatoryInfo = {
  cnpj: string;
  pharmacistName: string;
  pharmacistCrf: string;
};

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
    cnpj: g.cnpj,
    pharmacistName: g.pharmacistName,
    pharmacistCrf: g.pharmacistCrf,
  };
  if (!pharmacyId) return base;
  const ph = await prisma.pharmacy
    .findUnique({
      where: { id: pharmacyId },
      select: { cnpj: true, pharmacistName: true, pharmacistCrf: true },
    })
    .catch(() => null);
  return {
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
  return { ...base, freeMin: ph?.shippingFreeMin ?? base.freeMin };
}

/**
 * Distância (km) do destino a partir das faixas de CEP da unidade
 * (PharmacyCepRange.km): acha a faixa que contém o CEP e devolve seu km.
 * Sem faixa casada (ou km não cadastrado), cai no `defaultKm` da config.
 * É a fonte da verdade da distância usada no frete (server-side).
 */
export async function resolveKm(
  cep: string | null | undefined,
  pharmacyId?: string | null
): Promise<number> {
  const cfg = await getShippingConfig(pharmacyId);
  const digits = (cep ?? "").replace(/\D/g, "");
  if (digits.length < 8 || !pharmacyId) return cfg.defaultKm;
  const n = parseInt(digits.slice(0, 8), 10);
  const range = await prisma.pharmacyCepRange
    .findFirst({
      where: { pharmacyId, start: { lte: n }, end: { gte: n }, km: { not: null } },
      orderBy: { km: "asc" },
      select: { km: true },
    })
    .catch(() => null);
  return range?.km ?? cfg.defaultKm;
}
