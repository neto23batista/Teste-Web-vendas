/** Reposição recorrente, sem cobrança automática. Regras seguras para o cliente. */
export const SUBSCRIPTION_INTERVALS = [30, 60, 90] as const;

export function isValidInterval(days: number): boolean {
  return (SUBSCRIPTION_INTERVALS as readonly number[]).includes(days);
}

export function intervalLabel(days: number): string {
  if (days === 30) return "Mensal";
  if (days === 60) return "A cada 2 meses";
  if (days === 90) return "A cada 3 meses";
  return `A cada ${days} dias`;
}
