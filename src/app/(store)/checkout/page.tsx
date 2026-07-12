import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { getShippingConfig, resolveKm } from "@/lib/settings";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser();
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/sacola");

  const [rawAddresses, loyalty, shippingConfig, dbUser] = await Promise.all([
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
  ]);

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
      />
      </div>
    </div>
  );
}
