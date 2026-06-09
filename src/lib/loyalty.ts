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

/** Quantos pontos podem ser resgatados dado o saldo e a base (subtotal − cupom). */
export function maxRedeemablePoints(available: number, base: number): number {
  if (available <= 0 || base <= 0) return 0;
  const capByValue = Math.floor((base * REDEEM_MAX_FRACTION) / BRL_PER_POINT);
  return Math.max(0, Math.min(Math.floor(available), capByValue));
}

/** Converte pontos em desconto (R$), arredondado a centavos. */
export function pointsToBRL(points: number): number {
  return Math.round(Math.max(0, points) * BRL_PER_POINT * 100) / 100;
}
