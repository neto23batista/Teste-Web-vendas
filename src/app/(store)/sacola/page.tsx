import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingBag, ArrowRight, Truck, Tag } from "lucide-react";
import { getCart } from "@/lib/cart";
import { shippingFor, missingForFreeShipping, FREE_SHIPPING_MIN } from "@/lib/shipping";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CartItemRow } from "@/components/store/cart-item-row";

export const metadata: Metadata = { title: "Sacola" };

export default async function CartPage() {
  const cart = await getCart();

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto grid max-w-md place-items-center gap-4 rounded-3xl border border-dashed border-border bg-card py-16 text-center">
          <span className="grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
            <ShoppingBag className="size-9" />
          </span>
          <div>
            <p className="text-lg font-bold">Sua sacola está vazia</p>
            <p className="text-sm text-muted-foreground">
              Explore o catálogo e adicione seus produtos favoritos.
            </p>
          </div>
          <Button asChild variant="primary" size="lg">
            <Link href="/catalogo">
              Ir às compras <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const shipping = shippingFor(cart.subtotal);
  const missing = missingForFreeShipping(cart.subtotal);
  const total = cart.subtotal + shipping;

  return (
    <div className="container-page py-6 md:py-8">
      <h1 className="mb-6 text-2xl font-extrabold md:text-3xl">
        Sacola{" "}
        <span className="text-base font-semibold text-muted-foreground">
          ({cart.count} {cart.count === 1 ? "item" : "itens"})
        </span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Itens */}
        <div className="space-y-4">
          {missing > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-600/30 dark:bg-brand-600/10">
              <Truck className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <p>
                Faltam <strong>{formatBRL(missing)}</strong> para você ganhar{" "}
                <strong>frete grátis</strong>!
              </p>
            </div>
          )}

          <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
            {cart.items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          <Link
            href="/catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            <ArrowRight className="size-4 rotate-180" /> Continuar comprando
          </Link>
        </div>

        {/* Resumo */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Resumo do pedido</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold">{formatBRL(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Frete</dt>
                <dd className="font-semibold">
                  {shipping === 0 ? (
                    <span className="text-success-600">Grátis</span>
                  ) : (
                    formatBRL(shipping)
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="size-3.5" /> Frete grátis acima de{" "}
                {formatBRL(FREE_SHIPPING_MIN)}
              </div>
            </dl>
            <div className="flex items-end justify-between border-t border-border pt-4">
              <span className="font-bold">Total</span>
              <span className="text-2xl font-extrabold text-brand-700 dark:text-brand-400">
                {formatBRL(total)}
              </span>
            </div>
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link href="/checkout">
                Finalizar compra <ArrowRight className="size-5" />
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pagamento seguro · seus dados são protegidos
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
