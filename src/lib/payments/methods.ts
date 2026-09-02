/**
 * Quais meios de pagamento a loja REALMENTE consegue processar agora.
 *
 * Existe porque oferecer um meio que não funciona é pior do que não oferecer: o
 * pedido é criado, o cliente é mandado para a página de pagamento e não há QR nem
 * cobrança — o pedido fica PENDENTE para sempre e ele não tem como pagar. Dois
 * casos reais disso:
 *  - sem secret key do Stripe salva → Pix e cartão não têm como ser cobrados;
 *  - com chave válida, mas **Pix não habilitado** (no Stripe BR o Pix é liberado
 *    por convite) → o PaymentIntent de Pix falha e não vem QR.
 *
 * Dinheiro na entrega não depende de provedor nenhum, então é o piso: a loja nunca
 * fica sem forma de pagamento. Regra usada pelo formulário (o que mostrar) E pelo
 * servidor (o que aceitar) — o cliente não escolhe o que o servidor não valida.
 */
import type { PaymentSettings } from "@/lib/settings";

export type PaymentMethodId = "pix" | "card" | "cash";

export type PaymentAvailability = {
  /** Há secret key do Stripe salva/configurada. */
  stripeConfigured: boolean;
  /** A conta Stripe tem a capability `pix_payments` ativa. */
  pixEnabled: boolean;
};

/**
 * Deriva a disponibilidade a partir das configurações de pagamento salvas.
 * Fonte única para o formulário (o que mostrar) e o servidor (o que aceitar) —
 * evita a regra "tem chave?" divergir entre a página e o placeOrder.
 */
export function paymentAvailability(p: PaymentSettings): PaymentAvailability {
  return {
    stripeConfigured: p.stripeSecretKey.length > 0,
    pixEnabled: p.stripePixEnabled,
  };
}

/** Meios disponíveis, em ordem de preferência (o 1º vira o padrão). */
export function availablePaymentMethods(
  a: PaymentAvailability
): PaymentMethodId[] {
  const methods: PaymentMethodId[] = [];
  if (a.stripeConfigured && a.pixEnabled) methods.push("pix");
  if (a.stripeConfigured) methods.push("card");
  methods.push("cash");
  return methods;
}

/** Meio pré-selecionado no checkout: o melhor que estiver disponível. */
export function defaultPaymentMethod(a: PaymentAvailability): PaymentMethodId {
  return availablePaymentMethods(a)[0]!;
}

export function isPaymentMethodAvailable(
  method: string,
  a: PaymentAvailability
): method is PaymentMethodId {
  return (availablePaymentMethods(a) as string[]).includes(method);
}
