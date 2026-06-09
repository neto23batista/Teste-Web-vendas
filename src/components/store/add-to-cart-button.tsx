"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
  name: string;
  disabled?: boolean;
  qty?: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
  withIcon?: boolean;
};

export function AddToCartButton({
  productId,
  name,
  disabled,
  qty = 1,
  variant = "primary",
  size = "md",
  className,
  label = "Adicionar",
  withIcon = true,
}: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [added, setAdded] = React.useState(false);
  const isIcon = size === "icon" || size === "icon-sm";

  function handleAdd() {
    start(async () => {
      const res = await addToCart(productId, qty);
      if (res.ok) {
        setAdded(true);
        toast.success("Adicionado à sacola", { description: name });
        router.refresh();
        setTimeout(() => setAdded(false), 1400);
      } else {
        toast.error(res.error ?? "Não foi possível adicionar.");
      }
    });
  }

  const state = pending ? "pending" : added ? "added" : "idle";

  return (
    <Button
      type="button"
      variant={added ? "success" : variant}
      size={size}
      disabled={disabled || pending}
      onClick={handleAdd}
      className={cn("transition-colors", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 6, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.85 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-flex items-center gap-2"
        >
          {pending ? (
            <Loader2 className="size-[1.15em] animate-spin" />
          ) : added ? (
            <>
              <Check className="size-[1.15em]" /> {!isIcon && "Adicionado"}
            </>
          ) : (
            <>
              {withIcon &&
                (isIcon ? (
                  <Plus className="size-[1.15em]" />
                ) : (
                  <ShoppingBag className="size-[1.15em]" />
                ))}
              {!isIcon && label}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
