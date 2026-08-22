/**
 * Dinheiro cruza o núcleo da aplicação como centavos inteiros. Prisma.Decimal
 * é aceito estruturalmente por `toString`, sem levar decimal.js para o browser.
 */
export type MoneyValue = number | string | bigint | { toString(): string };

type MoneyOptions = { allowNegative?: boolean; rejectExtraScale?: boolean };

function decimalText(value: MoneyValue): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Números são apenas uma fronteira legada/UI. O núcleo persiste e soma
    // strings decimais/centavos; aqui expandimos notação científica se houver.
    if (/e/i.test(String(value))) return value.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  const text = typeof value === "string" ? value : value?.toString();
  return typeof text === "string" ? text.trim() : null;
}

/** Converte decimal em centavos seguros, arredondando meio centavo para longe de zero. */
export function moneyToCents(
  value: MoneyValue,
  options: MoneyOptions = {}
): number | null {
  const raw = decimalText(value);
  if (!raw) return null;
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const negative = match[1] === "-";
  if (negative && !options.allowNegative) return null;
  const fraction = match[3] ?? "";
  if (options.rejectExtraScale && fraction.length > 2) return null;

  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole)) return null;
  let cents = whole * 100 + Number((fraction + "00").slice(0, 2));
  if (fraction.length > 2 && Number(fraction[2]) >= 5) cents += 1;
  if (negative) cents = -cents;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Entrada monetária de formulário: aceita vírgula, mas no máximo 2 casas. */
export function parseMoneyInputToCents(
  value: unknown,
  options: Pick<MoneyOptions, "allowNegative"> = {}
): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim().replace(/^R\$\s*/i, "").replace(",", ".");
  return moneyToCents(normalized, { ...options, rejectExtraScale: true });
}

/** String canônica que Prisma grava em DECIMAL(12,2), sem passar por float. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new TypeError("Centavos inválidos.");
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Conversão somente na fronteira de apresentação/SDK que exige number. */
export function moneyToNumber(value: MoneyValue, allowNegative = false): number {
  const cents = moneyToCents(value, { allowNegative });
  if (cents === null) throw new TypeError("Valor monetário inválido.");
  return cents / 100;
}

export function centsToNumber(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new TypeError("Centavos inválidos.");
  return cents / 100;
}

/** Percentual decimal (ex.: "12.50") aplicado a centavos, com arredondamento. */
export function percentageOfCents(cents: number, percent: MoneyValue): number | null {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  const hundredths = moneyToCents(percent);
  if (hundredths === null) return null;
  // Decompõe antes de multiplicar para manter cada parcela dentro de safe int.
  const blocks = Math.floor(cents / 10_000);
  const remainder = cents % 10_000;
  const result = blocks * hundredths + Math.round((remainder * hundredths) / 10_000);
  return Number.isSafeInteger(result) ? result : null;
}
