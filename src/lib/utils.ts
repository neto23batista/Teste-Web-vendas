import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata um número como moeda BRL. */
export function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? n : 0);
}

/** Slug simples a partir de um texto. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Percentual de desconto entre preço cheio e promocional. */
export function discountPercent(price: number, promo?: number | null): number {
  if (!promo || promo <= 0 || price <= 0 || promo >= price) return 0;
  return Math.round((1 - promo / price) * 100);
}

/**
 * Serializa dados para dentro de uma tag `<script type="application/ld+json">`.
 * `JSON.stringify` NÃO escapa `<`, então um nome de produto contendo `</script>`
 * fecharia a tag e injetaria HTML na página (XSS). Escapa os caracteres com
 * significado em HTML e os separadores de linha que quebram o parser de JS.
 */
// `<`, `>`, `&` e os separadores de linha U+2028/U+2029. Montado por código de
// caractere: um U+2028 literal dentro de uma regex é erro de sintaxe em JS.
const LD_UNSAFE = new RegExp(
  "[<>&" + String.fromCharCode(0x2028, 0x2029) + "]",
  "g"
);

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(
    LD_UNSAFE,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}
