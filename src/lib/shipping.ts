export const FREE_SHIPPING_MIN = 150;
export const SHIPPING_FLAT = 14.9; // custo padrão quando o CEP é desconhecido

/** Parâmetros de frete configuráveis pelo dono em /admin/configuracoes.
 *  Este módulo roda também no client (checkout), então recebe a config por
 *  parâmetro — quem busca no banco é src/lib/settings.ts (server). */
export type ShippingConfig = { flat: number; freeMin: number };

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  flat: SHIPPING_FLAT,
  freeMin: FREE_SHIPPING_MIN,
};

// Adicional por região do CEP (1º dígito) somado à taxa base — aproximação
// geográfica do Brasil. Sem peso de produto no schema, usamos a região do
// destino como proxy de frete.
const REGION_EXTRA: Record<string, number> = {
  "0": 0, // SP (capital e Grande SP)
  "1": 0, // SP (interior/litoral)
  "2": 3, // RJ, ES
  "3": 3, // MG
  "4": 7, // BA, SE
  "5": 10, // PE, AL, PB, RN
  "6": 13, // CE, PI, MA, PA, AM, AP, RR
  "7": 7, // DF, GO, TO, MT, MS, RO, AC
  "8": 3, // PR, SC
  "9": 5, // RS
};

/**
 * Frete: grátis acima do mínimo (ou carrinho vazio); senão taxa base + adicional
 * por região do CEP de destino. Sem CEP (ex.: sacola antes do endereço) usa só
 * a taxa base.
 */
export function shippingFor(
  subtotal: number,
  cep?: string | null,
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): number {
  if (subtotal <= 0 || subtotal >= config.freeMin) return 0;
  const digit = (cep ?? "").replace(/\D/g, "")[0];
  if (!digit) return config.flat;
  return Math.round((config.flat + (REGION_EXTRA[digit] ?? 0)) * 100) / 100;
}

export function missingForFreeShipping(
  subtotal: number,
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): number {
  return Math.max(0, config.freeMin - subtotal);
}
