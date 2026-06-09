import {
  CircleDashed,
  CheckCircle2,
  Package,
  Truck,
  Home,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Aguardando pagamento", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  PAID: { label: "Pagamento aprovado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  PREPARING: { label: "Em preparação", className: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300" },
  SHIPPED: { label: "Enviado", className: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300" },
  DELIVERED: { label: "Entregue", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  CANCELED: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", meta.className)}>
      {meta.label}
    </span>
  );
}

const steps = [
  { key: "PENDING", label: "Recebido", icon: CircleDashed },
  { key: "PAID", label: "Pago", icon: CheckCircle2 },
  { key: "PREPARING", label: "Preparando", icon: Package },
  { key: "SHIPPED", label: "Enviado", icon: Truck },
  { key: "DELIVERED", label: "Entregue", icon: Home },
] as const;

const order = ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED"];

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "CANCELED") {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
        <XCircle className="size-5" /> Pedido cancelado
      </div>
    );
  }
  // PREPARING também conta como pago
  const effective = status === "PREPARING" ? "PREPARING" : status;
  const currentIdx = order.indexOf(effective);

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i <= currentIdx ? "bg-brand-600" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition",
                  done
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i < currentIdx ? "bg-brand-600" : "bg-border"
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-[0.7rem] font-medium",
                done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
