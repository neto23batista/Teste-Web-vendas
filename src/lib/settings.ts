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

export type StoreSettings = {
  shipping: ShippingConfig;
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
      flat: num(s["shipping.flat"], DEFAULT_SHIPPING_CONFIG.flat),
      freeMin: num(s["shipping.freeMin"], DEFAULT_SHIPPING_CONFIG.freeMin),
    },
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

export async function getShippingConfig(): Promise<ShippingConfig> {
  return (await getStoreSettings()).shipping;
}
