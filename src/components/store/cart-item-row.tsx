"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCartItem, removeCartItem } from "@/actions/cart";
import { ProductImage } from "@/components/store/product-image";
import { formatBRL } from "@/lib/utils";
import type { CartItemView } from "@/lib/cart";

// Mantido em sincronia com a validação server-side de varejo. Não importe
// `lib/orders` neste Client Component: esse módulo também depende do Prisma.
const MAX_ITEM_QUANTITY = 99;

export function CartItemRow({ item }: { item: CartItemView }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const unit = item.product.promoPrice ?? item.product.price;

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    fallback: string
  ) =>
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error ?? fallback);
        }
      } catch {
        toast.error(fallback);
      } finally {
        // Algumas falhas também corrigem o carrinho no servidor (por exemplo,
        // removendo um item que ficou sem estoque), então sempre sincroniza.
        router.refresh();
      }
    });

  const change = (qty: number) =>
    run(
      () => updateCartItem(item.id, qty),
      "Não foi possível atualizar a quantidade."
    );

  const remove = () =>
    run(
      () => removeCartItem(item.id),
      "Não foi possível remover o produto."
    );

  return (
    <div className="flex gap-4 py-4" aria-busy={pending}>
      <Link href={`/produto/${item.product.slug}`} className="shrink-0">
        <ProductImage
          src={item.product.images[0]?.url}
          emoji={item.product.emoji}
          name={item.product.name}
          className="size-20 rounded-2xl"
          emojiClassName="text-3xl"
          sizes="80px"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        <Link
          href={`/produto/${item.product.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug hover:text-brand-600 dark:hover:text-brand-400"
        >
          {item.product.name}
        </Link>
        <p className="text-sm font-bold text-brand-700 dark:text-brand-400">
          {formatBRL(unit)}
        </p>

        <div className="mt-1 flex items-center justify-between">
          <div className="inline-flex items-center rounded-xl border border-border">
            <button
              onClick={() => change(item.qty - 1)}
              disabled={pending}
              aria-label={`Diminuir quantidade de ${item.product.name}`}
              className="grid size-11 place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span
              className="w-8 text-center text-sm font-bold"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {pending ? (
                <>
                  <Loader2
                    className="mx-auto size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Atualizando quantidade</span>
                </>
              ) : (
                <>
                  <span className="sr-only">Quantidade: </span>
                  {item.qty}
                </>
              )}
            </span>
            <button
              onClick={() => change(item.qty + 1)}
              disabled={
                pending ||
                item.qty >= item.product.stock ||
                item.qty >= MAX_ITEM_QUANTITY
              }
              aria-label={`Aumentar quantidade de ${item.product.name}`}
              className="grid size-11 place-items-center rounded-r-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <button
            onClick={remove}
            disabled={pending}
            aria-label={`Remover ${item.product.name} da sacola`}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Remover
          </button>
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-extrabold">{formatBRL(unit * item.qty)}</p>
      </div>
    </div>
  );
}
