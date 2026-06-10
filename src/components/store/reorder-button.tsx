"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reorder } from "@/actions/reorder";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ReorderButton({
  orderNumber,
  variant = "outline",
  size = "md",
  className,
  label = "Comprar novamente",
}: {
  orderNumber: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function handle() {
    start(async () => {
      const res = await reorder(orderNumber);
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível recomprar.");
        return;
      }
      if (res.added === 0) {
        toast.error("Os itens deste pedido estão indisponíveis no momento.");
        return;
      }
      const aviso =
        res.skipped > 0
          ? ` · ${res.skipped} item(ns) indisponível(is) ficaram de fora`
          : "";
      toast.success("Itens adicionados à sacola" + aviso);
      router.push("/sacola");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={handle}
      className={className}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <RotateCcw />
      )}
      {label}
    </Button>
  );
}
