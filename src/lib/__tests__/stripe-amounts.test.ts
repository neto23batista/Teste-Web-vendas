import { describe, it, expect } from "vitest";
import { hostedCheckoutAmounts } from "@/lib/stripe";

/** Como o checkout monta o total do pedido (src/actions/checkout.ts). */
const orderTotal = (subtotal: number, discount: number, shipping: number) =>
  Math.max(0, subtotal - discount) + shipping;

const cents = (v: number) => Math.round(v * 100);

describe("hostedCheckoutAmounts", () => {
  it("sem desconto: cobra os itens + frete e não cria cupom", () => {
    const items = [{ name: "Dipirona", price: 19.9, qty: 2 }];
    const total = orderTotal(39.8, 0, 10);
    const a = hostedCheckoutAmounts(items, 10, total);
    expect(a.discountCents).toBe(0);
    expect(a.chargedCents).toBe(cents(total)); // 4980
  });

  it("com cupom: o cobrado é o total COM desconto (não o preço cheio)", () => {
    const items = [{ name: "Dipirona", price: 50, qty: 1 }];
    const total = orderTotal(50, 15, 10); // 45
    const a = hostedCheckoutAmounts(items, 10, total);
    expect(a.discountCents).toBe(1500);
    expect(a.chargedCents).toBe(cents(total)); // 4500, não 6000
  });

  it("cupom percentual com frete fracionado: bate CENTAVO A CENTAVO com o total", () => {
    // O caso que quebra se itens/frete/desconto forem arredondados separados:
    // 10% de 59,97 = 5,997 e frete 8,333.
    const items = [{ name: "Vitamina C", price: 19.99, qty: 3 }];
    const subtotal = 59.97;
    const discount = subtotal * 0.1; // 5.997
    const shipping = 8.333;
    const total = orderTotal(subtotal, discount, shipping);
    const a = hostedCheckoutAmounts(items, shipping, total);
    expect(a.chargedCents).toBe(cents(total));
  });

  it("desconto maior que o subtotal: zera os itens mas o frete continua cobrado", () => {
    const items = [{ name: "Dipirona", price: 20, qty: 1 }];
    const total = orderTotal(20, 50, 10); // 10 (só o frete)
    const a = hostedCheckoutAmounts(items, 10, total);
    expect(a.discountCents).toBe(2000); // nunca passa do subtotal
    expect(a.chargedCents).toBe(cents(total)); // 1000
  });

  it("frete grátis com desconto: cobra só o que sobrou dos itens", () => {
    const items = [
      { name: "A", price: 12.5, qty: 2 },
      { name: "B", price: 7.35, qty: 1 },
    ];
    const subtotal = 32.35;
    const total = orderTotal(subtotal, 5, 0);
    const a = hostedCheckoutAmounts(items, 0, total);
    expect(a.chargedCents).toBe(cents(total)); // 2735
  });
});
