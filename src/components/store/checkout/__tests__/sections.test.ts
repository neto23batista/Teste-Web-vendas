import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckoutAddressSection } from "../address-section";
import { CheckoutDeliverySection } from "../delivery-section";
import { CheckoutPaymentSection } from "../payment-section";
import { CheckoutSummary } from "../summary";
import { deliveryOptions } from "@/lib/shipping/rates";

const noop = () => {};
const quote = {
  subtotal: 100,
  couponCode: null,
  couponDiscount: 0,
  redeemPoints: 20,
  redeemDiscount: 1,
  discount: 1,
  shipping: 5,
  total: 104,
  deliveryMethod: "standard" as const,
};
const summaryProps: Parameters<typeof CheckoutSummary>[0] = {
  coupon: "",
  setCoupon: noop,
  quote,
  quoteError: null,
  quoteRefreshing: false,
  canQuote: true,
  retryQuote: noop,
  usePoints: true,
  setUsePoints: noop,
  maxRedeem: 40,
  points: 40,
  delivery: "standard",
  pending: false,
  amounts: { subtotal: 100, shipping: 5, redeemDiscount: 1, total: 104 },
};

describe("seções do checkout", () => {
  it("preserva os nomes enviados ao servidor no novo endereço", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutAddressSection, {
        addresses: [],
        addressId: "new",
        setAddressId: noop,
        isNew: true,
        newZip: "",
        setNewZip: noop,
        cepLoading: false,
        handleCepBlur: async () => {},
      }),
    );
    for (const name of [
      "addressId",
      "recipient",
      "zip",
      "street",
      "number",
      "complement",
      "district",
      "city",
      "state",
    ])
      expect(html).toContain(`name="${name}"`);
    expect(html).toContain('for="zip"');
  });

  it("preserva a modalidade selecionada e foco visível", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutDeliverySection, {
        options: deliveryOptions(100, 2),
        delivery: "express",
        setDelivery: noop,
      }),
    );
    expect(html).toMatch(/name="deliveryMethod"[^>]*value="express"/);
    expect(html).toContain("focus-within:ring-2");
  });

  it("não oferece cartão ou Pix sem disponibilidade informada pelo servidor", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutPaymentSection, {
        availability: { stripeConfigured: false, pixEnabled: false },
        method: "cash",
        setMethod: noop,
        hasCpf: false,
      }),
    );
    expect(html).toContain('value="cash"');
    expect(html).not.toContain('value="card"');
    expect(html).not.toContain('value="pix"');
  });

  it("solicita CPF no Pix quando ele ainda não foi cadastrado", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutPaymentSection, {
        availability: { stripeConfigured: true, pixEnabled: true },
        method: "pix",
        setMethod: noop,
        hasCpf: false,
      }),
    );
    expect(html).toContain('name="cpf"');
    expect(html).toContain('aria-required="true"');
    expect(html).not.toContain("3x sem juros");
  });

  it("envia o resgate confirmado no servidor, não o máximo apenas exibido", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutSummary, summaryProps),
    );
    expect(html).toMatch(/name="redeemPoints"[^>]*value="20"/);
    expect(html).toContain('aria-live="polite"');
  });

  it.each([
    { quote: null, quoteRefreshing: true, pending: false },
    { quote, quoteRefreshing: false, pending: true },
    { quote: null, quoteRefreshing: false, pending: false },
  ])(
    "bloqueia envio sem cotação atual ou durante processamento: %o",
    (state) => {
      const html = renderToStaticMarkup(
        createElement(CheckoutSummary, { ...summaryProps, ...state }),
      );
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    },
  );

  it("oferece recuperação explícita quando a consulta do total falha", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutSummary, {
        ...summaryProps,
        quote: null,
        quoteError: "Falha de conexão",
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Recalcular pedido");
    expect(html).toContain('type="button"');
  });
});
