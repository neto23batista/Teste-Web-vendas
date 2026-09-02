// Conversão de pontos de fidelidade em desconto no checkout.
//
// Ganho: 1 ponto por R$ 1 em compras aprovadas (ver fulfillOrder).
// Resgate: 1 ponto = R$ 0,05 (≈ 5% de "cashback"). O resgate é limitado a 50%
// da base (subtotal já com o cupom aplicado) para nunca zerar o pedido.
//
// Módulo puro (sem acesso a banco) — pode ser importado no cliente para o
// cálculo ao vivo no checkout e no servidor para validar o débito.

export const BRL_PER_POINT = 0.05;
export const REDEEM_MAX_FRACTION = 0.5;
export const CENTS_PER_POINT = 5;

/** Quantos pontos podem ser resgatados dado o saldo e a base (subtotal − cupom). */
export function maxRedeemablePoints(available: number, base: number): number {
  if (available <= 0 || base <= 0) return 0;
  const capByValue = Math.floor((base * REDEEM_MAX_FRACTION) / BRL_PER_POINT);
  return Math.max(0, Math.min(Math.floor(available), capByValue));
}

/** Converte pontos em desconto (R$), arredondado a centavos. */
export function pointsToBRL(points: number): number {
  return pointsToCents(points) / 100;
}

export function pointsToCents(points: number): number {
  if (!Number.isSafeInteger(points) || points <= 0) return 0;
  const cents = points * CENTS_PER_POINT;
  return Number.isSafeInteger(cents) ? cents : 0;
}

/** Versão usada pelo checkout: base em centavos, sem ponto flutuante. */
export function maxRedeemablePointsForCents(
  available: number,
  baseCents: number
): number {
  if (!Number.isSafeInteger(available) || !Number.isSafeInteger(baseCents)) return 0;
  if (available <= 0 || baseCents <= 0) return 0;
  // 50% da base / 5 centavos por ponto = baseCents / 10.
  return Math.max(0, Math.min(available, Math.floor(baseCents / 10)));
}
