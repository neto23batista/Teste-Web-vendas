"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { updateOrderStatus } from "@/client/api/admin";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/contracts/domain";

const options: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "Aguardando pagamento" },
  { value: "PAID", label: "Pago" },
  { value: "PREPARING", label: "Em preparação" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELED", label: "Cancelado" },
];

export function OrderStatusControl({
  id,
  current,
  allowed,
}: {
  id: string;
  current: OrderStatus;
  allowed: readonly OrderStatus[];
}) {
  const [value, setValue] = React.useState<OrderStatus>(current);
  const { pending, confirm, dialog } = useConfirmAction();
  const selected = allowed.includes(value) || value === current ? value : current;

  function apply() {
    confirm({
      title: selected === "CANCELED" ? "Cancelar pedido" : "Alterar status do pedido",
      confirmLabel: selected === "CANCELED" ? "Cancelar pedido" : "Atualizar status",
      destructive: selected === "CANCELED",
      confirmMessage: selected === "CANCELED"
        ? "O pedido será cancelado e o saldo elegível será liberado. Se houver cobrança, o reembolso será acompanhado separadamente. Confira o pedido antes de confirmar."
        : `Mudar de “${options.find((o) => o.value === current)?.label}” para “${options.find((o) => o.value === selected)?.label}”? A mudança ficará no histórico do pedido.`,
      action: () => updateOrderStatus(id, selected),
      successMessage: selected === "CANCELED" ? "Cancelamento confirmado. Confira a situação do reembolso no pedido." : "Status atualizado.",
      warningMessage: "Cancelamento registrado. O reembolso ainda precisa de acompanhamento no painel financeiro.",
    });
  }

  return (
    <div className="space-y-2">
      {dialog}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Status do pedido"
          value={selected}
          disabled={pending}
          onChange={(e) => setValue(e.target.value as OrderStatus)}
          className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
        >
          {options
            .filter((o) => o.value === current || (allowed.includes(o.value) && o.value !== "SHIPPED" && o.value !== "DELIVERED"))
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
        <Button onClick={apply} variant="primary" disabled={pending || selected === current}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
          Atualizar
        </Button>
      </div>
      {(current === "PREPARING" || current === "SHIPPED") && (
        <p className="text-xs text-muted-foreground">
          O despacho e a confirmação com comprovante são feitos no{" "}
          <Link href="/admin/entregas" className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400">
            painel de Entregas
          </Link>.
        </p>
      )}
    </div>
  );
}
