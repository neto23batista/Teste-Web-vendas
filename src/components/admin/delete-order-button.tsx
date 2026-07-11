"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOrder } from "@/actions/admin-orders";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de EXCLUSÃO PERMANENTE de um pedido (dono/gerente). Dois formatos:
 * - `compact`: ícone de lixeira para as linhas da lista;
 * - padrão: botão "Excluir pedido" para a página de detalhe.
 * `redirectToList` leva de volta à lista após excluir (o detalhe deixa de existir).
 */
export function DeleteOrderButton({
  orderId,
  orderNumber,
  compact = false,
  redirectToList = false,
  className,
}: {
  orderId: string;
  orderNumber: string;
  compact?: boolean;
  redirectToList?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function handleDelete(e: React.MouseEvent) {
    // Nas linhas da lista o botão pode estar sobre áreas clicáveis — não propaga.
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Excluir o pedido ${orderNumber} permanentemente?\n\n` +
          "O registro será apagado e não poderá ser recuperado. Isto NÃO " +
          "estorna pagamento nem devolve estoque — para isso, cancele o pedido."
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteOrder(orderId);
      if (res.ok) {
        toast.success(`Pedido ${orderNumber} excluído.`);
        if (redirectToList) router.push("/admin/pedidos");
        else router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível excluir o pedido.");
      }
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Excluir pedido ${orderNumber}`}
        title="Excluir pedido"
        className={cn(
          "inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50",
          className
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={handleDelete}
      variant="outline"
      size="lg"
      disabled={pending}
      className={cn("w-full text-danger-500 hover:bg-danger-500/10", className)}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Trash2 className="size-5" />
      )}
      Excluir pedido
    </Button>
  );
}
