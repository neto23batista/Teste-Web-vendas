"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { updateCartItem, removeCartItem } from "@/actions/cart";
import { ProductImage } from "@/components/store/product-image";
import { formatBRL } from "@/lib/utils";
import type { CartItemView } from "@/lib/cart";

export function CartItemRow({ item }: { item: CartItemView }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const unit = item.product.promoPrice ?? item.product.price;

  const change = (qty: number) =>
    start(async () => {
      await updateCartItem(item.id, qty);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      await removeCartItem(item.id);
      router.refresh();
    });

  return (
    <div className="flex gap-4 py-4">
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
              aria-label="Diminuir"
              className="grid size-11 place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold">
              {pending ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : item.qty}
            </span>
            <button
              onClick={() => change(item.qty + 1)}
              disabled={pending || item.qty >= item.product.stock}
              aria-label="Aumentar"
              className="grid size-11 place-items-center rounded-r-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <button
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-danger-500"
          >
            <Trash2 className="size-4" /> Remover
          </button>
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-extrabold">{formatBRL(unit * item.qty)}</p>
      </div>
    </div>
  );
}
