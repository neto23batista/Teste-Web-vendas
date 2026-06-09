"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Loader2, FileText } from "lucide-react";
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
          emoji={item.product.emoji}
          name={item.product.name}
          className="size-20 rounded-2xl"
          emojiClassName="text-3xl"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        <Link
          href={`/produto/${item.product.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug hover:text-brand-600 dark:hover:text-brand-400"
        >
          {item.product.name}
        </Link>
        {item.product.requiresPrescription && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <FileText className="size-3" /> Receita
          </span>
        )}
        <p className="text-sm font-bold text-brand-700 dark:text-brand-400">
          {formatBRL(unit)}
        </p>

        <div className="mt-1 flex items-center justify-between">
          <div className="inline-flex items-center rounded-xl border border-border">
            <button
              onClick={() => change(item.qty - 1)}
              disabled={pending}
              aria-label="Diminuir"
              className="grid size-9 place-items-center rounded-l-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold">
              {pending ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : item.qty}
            </span>
            <button
              onClick={() => change(item.qty + 1)}
              disabled={pending || item.qty >= item.product.stock}
              aria-label="Aumentar"
              className="grid size-9 place-items-center rounded-r-xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-3.5" />
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
