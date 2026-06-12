import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCart } from "@/lib/cart";
import { getShippingConfig } from "@/lib/settings";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser();
  const cart = await getCart();
  if (!cart || cart.items.length === 0) redirect("/sacola");

  const [addresses, loyalty, shippingConfig] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefault: "desc" },
    }),
    prisma.loyaltyAccount.findUnique({
      where: { userId: user.id },
      select: { points: true },
    }),
    getShippingConfig(),
  ]);

  return (
    <div className="container-page py-6 md:py-8">
      <h1 className="mb-6 text-2xl font-extrabold md:text-3xl">
        Finalizar compra
      </h1>
      <CheckoutForm
        addresses={addresses}
        subtotal={cart.subtotal}
        requiresPrescription={cart.requiresPrescription}
        points={loyalty?.points ?? 0}
        shippingConfig={shippingConfig}
      />
    </div>
  );
}
