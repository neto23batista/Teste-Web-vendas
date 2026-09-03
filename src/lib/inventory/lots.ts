const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Validade é uma data civil, não o horário do servidor. Os lotes são gravados
 * ao meio-dia UTC; comparar com o início da data brasileira mantém o lote
 * válido durante todo o dia informado, inclusive em servidores UTC.
 */
export function inventoryLotDateCutoff(now = new Date()): Date {
  const parts = businessDateFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}

/** Recusa datas inexistentes (como 30/02) e datas já vencidas em São Paulo. */
export function parseInventoryLotExpiry(value: string, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date >= inventoryLotDateCutoff(now) ? date : null;
}

/**
 * Falha de política de lote. A mensagem é escrita para o operador do painel e
 * NÃO deve ser exibida ao cliente sem tradução — ver `InventoryExpiredStockError`
 * para o único caso em que a causa é explicável na loja.
 */
export class InventoryLotBalanceError extends Error {}

/**
 * Existe estoque físico, mas não estoque VÁLIDO: parte do saldo está em lote
 * vencido. É regra de negócio esperada (não incidente), então o checkout mostra
 * esta mensagem ao cliente em vez de um erro genérico.
 *
 * Herda de `InventoryLotBalanceError` de propósito: quem já trata a família
 * inteira — as ações de estoque e a importação de catálogo — continua valendo
 * sem alteração; só quem precisa separar incidente de regra testa a subclasse.
 */
export class InventoryExpiredStockError extends InventoryLotBalanceError {}

export function inventoryLotAvailability(
  stock: number,
  lots: readonly { qty: number; expiresAt: Date }[],
  now = new Date()
) {
  const dateCutoff = inventoryLotDateCutoff(now);
  const trackedQty = lots.reduce((sum, lot) => sum + lot.qty, 0);
  const expiredQty = lots.reduce((sum, lot) => sum + (lot.expiresAt < dateCutoff ? lot.qty : 0), 0);
  if (!Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(trackedQty) || trackedQty > stock) {
    throw new InventoryLotBalanceError("O saldo dos lotes diverge do estoque da unidade. Solicite a conferência do estoque.");
  }
  return { dateCutoff, trackedQty, expiredQty, availableStock: stock - expiredQty };
}
