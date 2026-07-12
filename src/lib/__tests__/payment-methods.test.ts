import { describe, it, expect } from "vitest";
import {
  availablePaymentMethods,
  defaultPaymentMethod,
  isPaymentMethodAvailable,
} from "@/lib/payment-methods";

const SEM_STRIPE = { stripeConfigured: false, pixEnabled: false };
const SEM_PIX = { stripeConfigured: true, pixEnabled: false };
const COMPLETO = { stripeConfigured: true, pixEnabled: true };

describe("availablePaymentMethods", () => {
  it("sem chave do Stripe: só dinheiro na entrega", () => {
    // Sem provedor não há como cobrar cartão nem Pix — oferecer levaria o cliente
    // a um pedido que ele não consegue pagar.
    expect(availablePaymentMethods(SEM_STRIPE)).toEqual(["cash"]);
  });

  it("Pix NÃO habilitado no Stripe: some do checkout (cartão + dinheiro)", () => {
    // No Stripe BR o Pix é liberado por convite: a chave é válida, mas o
    // PaymentIntent de Pix falha e o cliente ficaria sem QR.
    expect(availablePaymentMethods(SEM_PIX)).toEqual(["card", "cash"]);
    expect(availablePaymentMethods(SEM_PIX)).not.toContain("pix");
  });

  it("Pix habilitado: os três meios", () => {
    expect(availablePaymentMethods(COMPLETO)).toEqual(["pix", "card", "cash"]);
  });

  it("dinheiro na entrega nunca some — a loja sempre tem como vender", () => {
    for (const a of [SEM_STRIPE, SEM_PIX, COMPLETO]) {
      expect(availablePaymentMethods(a)).toContain("cash");
    }
  });
});

describe("defaultPaymentMethod", () => {
  it("cai para cartão quando o Pix está indisponível", () => {
    // Antes o padrão era "pix" fixo — justamente o caminho morto.
    expect(defaultPaymentMethod(SEM_PIX)).toBe("card");
  });
  it("cai para dinheiro quando não há Stripe", () => {
    expect(defaultPaymentMethod(SEM_STRIPE)).toBe("cash");
  });
  it("usa Pix quando ele funciona", () => {
    expect(defaultPaymentMethod(COMPLETO)).toBe("pix");
  });
});

describe("isPaymentMethodAvailable", () => {
  it("recusa pix quando o Stripe não tem Pix (trava do servidor)", () => {
    expect(isPaymentMethodAvailable("pix", SEM_PIX)).toBe(false);
  });
  it("recusa cartão sem chave do Stripe", () => {
    expect(isPaymentMethodAvailable("card", SEM_STRIPE)).toBe(false);
  });
  it("recusa valor inventado no formulário", () => {
    expect(isPaymentMethodAvailable("boleto", COMPLETO)).toBe(false);
    expect(isPaymentMethodAvailable("", COMPLETO)).toBe(false);
  });
  it("aceita o que está disponível", () => {
    expect(isPaymentMethodAvailable("cash", SEM_STRIPE)).toBe(true);
    expect(isPaymentMethodAvailable("pix", COMPLETO)).toBe(true);
  });
});
