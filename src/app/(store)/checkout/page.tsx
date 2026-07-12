import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { getShippingConfig, getPaymentSettings, resolveKm } from "@/lib/settings";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser();
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/sacola");

  const [rawAddresses, loyalty, shippingConfig, dbUser, payment] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefault: "desc" },
    }),
    prisma.loyaltyAccount.findUnique({
      where: { userId: user.id },
      select: { points: true },
    }),
    getShippingConfig(cart.pharmacyId),
    prisma.user.findUnique({ where: { id: user.id }, select: { cpf: true } }),
    getPaymentSettings(),
  ]);

  // Só oferece o que dá para cobrar de verdade. As CHAVES não vão para o cliente —
  // só dois booleanos. Sem Stripe, resta dinheiro na entrega; com Stripe mas sem
  // Pix habilitado, resta cartão + dinheiro (o Pix do Stripe BR é por convite).
  const availability = {
    stripeConfigured: payment.stripeSecretKey.length > 0,
    pixEnabled: payment.stripePixEnabled,
  };

  // Resolve a distância (km) de cada endereço salvo pela faixa de CEP da unidade,
  // para o resumo de frete recalcular ao trocar de endereço/modalidade no cliente.
  const addresses = await Promise.all(
    rawAddresses.map(async (a) => ({
      ...a,
      km: await resolveKm(a.zip, cart.pharmacyId),
    }))
  );

  return (
    <div className="aurora">
      <div className="container-page py-6 md:py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
        Pagamento seguro
      </p>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight md:text-3xl">
        Finalizar compra
      </h1>
      <CheckoutForm
        addresses={addresses}
        subtotal={cart.subtotal}
        requiresPrescription={cart.requiresPrescription}
        points={loyalty?.points ?? 0}
        shippingConfig={shippingConfig}
        defaultKm={shippingConfig.defaultKm}
        hasCpf={!!dbUser?.cpf}
        availability={availability}
      />
      </div>
    </div>
  );
}
