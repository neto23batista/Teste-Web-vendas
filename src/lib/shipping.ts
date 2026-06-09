export const FREE_SHIPPING_MIN = 150;
export const SHIPPING_FLAT = 14.9; // custo padrão quando o CEP é desconhecido

// Custo base por região do CEP (1º dígito) — aproximação geográfica do Brasil.
// Sem peso de produto no schema, usamos a região do destino como proxy de frete.
const REGION_COST: Record<string, number> = {
  "0": 14.9, // SP (capital e Grande SP)
  "1": 14.9, // SP (interior/litoral)
  "2": 17.9, // RJ, ES
  "3": 17.9, // MG
  "4": 21.9, // BA, SE
  "5": 24.9, // PE, AL, PB, RN
  "6": 27.9, // CE, PI, MA, PA, AM, AP, RR
  "7": 21.9, // DF, GO, TO, MT, MS, RO, AC
  "8": 17.9, // PR, SC
  "9": 19.9, // RS
};

/**
 * Frete: grátis acima do mínimo (ou carrinho vazio); senão custo por região do
 * CEP de destino. Sem CEP (ex.: sacola antes do endereço) usa o valor padrão.
 */
export function shippingFor(subtotal: number, cep?: string | null): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_MIN) return 0;
  const digit = (cep ?? "").replace(/\D/g, "")[0];
  if (!digit) return SHIPPING_FLAT;
  return REGION_COST[digit] ?? SHIPPING_FLAT;
}

export function missingForFreeShipping(subtotal: number): number {
  return Math.max(0, FREE_SHIPPING_MIN - subtotal);
}
