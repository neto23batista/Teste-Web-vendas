"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/actions/admin-orders";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@prisma/client";

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
}: {
  id: string;
  current: OrderStatus;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<OrderStatus>(current);
  const [pending, start] = React.useTransition();

  function apply() {
    start(async () => {
      const res = await updateOrderStatus(id, value);
      if (res.ok) {
        toast.success("Status atualizado");
        router.refresh();
      } else {
        toast.error(res.error);
        setValue(current); // desfaz a seleção inválida
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as OrderStatus)}
        className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button onClick={apply} variant="primary" disabled={pending || value === current}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
        Atualizar
      </Button>
    </div>
  );
}
