"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";

export function ProductPurchase({
  productId,
  name,
  maxStock,
  disabled,
}: {
  productId: string;
  name: string;
  maxStock: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = React.useState(1);
  const [pending, start] = React.useTransition();
  const [added, setAdded] = React.useState(false);

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(maxStock || 99, q + 1));

  function add() {
    start(async () => {
      const res = await addToCart(productId, qty);
      if (res.ok) {
        setAdded(true);
        toast.success("Adicionado à sacola", { description: `${qty}× ${name}` });
        router.refresh();
        setTimeout(() => setAdded(false), 1500);
      } else {
        toast.error(res.error ?? "Não foi possível adicionar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="inline-flex h-13 items-center rounded-2xl border border-border bg-card">
        <button
          onClick={dec}
          disabled={disabled || qty <= 1}
          aria-label="Diminuir"
          className="grid size-12 place-items-center rounded-l-2xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-10 text-center text-base font-bold">{qty}</span>
        <button
          onClick={inc}
          disabled={disabled || qty >= maxStock}
          aria-label="Aumentar"
          className="grid size-12 place-items-center rounded-r-2xl text-muted-foreground transition hover:bg-muted disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <Button
        onClick={add}
        disabled={disabled || pending}
        variant="primary"
        size="lg"
        className="flex-1"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : added ? (
          <>
            <Check className="size-5" /> Adicionado
          </>
        ) : (
          <>
            <ShoppingBag className="size-5" /> Adicionar à sacola
          </>
        )}
      </Button>
    </div>
  );
}
