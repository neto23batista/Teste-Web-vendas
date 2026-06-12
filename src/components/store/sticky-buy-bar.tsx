"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { formatBRL } from "@/lib/utils";

/**
 * Barra de compra fixa no mobile (padrão de apps de delivery): preço sempre
 * visível + CTA de adicionar, flutuando acima do bottom-nav. Some no desktop.
 */
export function StickyBuyBar({
  productId,
  name,
  price,
  oldPrice,
  disabled,
}: {
  productId: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [added, setAdded] = React.useState(false);

  function add() {
    start(async () => {
      const res = await addToCart(productId, 1);
      if (res.ok) {
        setAdded(true);
        toast.success("Adicionado à sacola", { description: name });
        router.refresh();
        setTimeout(() => setAdded(false), 1500);
      } else {
        toast.error(res.error ?? "Não foi possível adicionar.");
      }
    });
  }

  return (
    <div
      className="glass-surface fixed inset-x-3 bottom-[5.25rem] z-40 flex items-center gap-3 rounded-2xl p-3 shadow-[var(--shadow-card)] md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="min-w-0 flex-1 pl-1 leading-tight">
        {oldPrice != null && (
          <p className="text-xs text-muted-foreground line-through">
            {formatBRL(oldPrice)}
          </p>
        )}
        <p className="text-lg font-extrabold text-brand-700 dark:text-brand-400">
          {formatBRL(price)}
        </p>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={disabled || pending}
        className="gradient-brand inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition active:scale-95 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : added ? (
          <>
            <Check className="size-5" /> Adicionado
          </>
        ) : disabled ? (
          "Sem estoque"
        ) : (
          <>
            <ShoppingBag className="size-5" /> Adicionar
          </>
        )}
      </button>
    </div>
  );
}
