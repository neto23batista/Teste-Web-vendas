"use client";

import { SUBSCRIPTION_INTERVALS, intervalLabel } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

/**
 * Seletor de frequência de reposição (mensal / a cada 2 ou 3 meses).
 * Compartilhado pela página de produto (escolha antes de ativar) e pelo card de
 * assinatura na conta (troca imediata). Clicar na opção já ativa é no-op.
 */
export function IntervalPicker({
  value,
  onSelect,
  disabled = false,
  className,
}: {
  value: number;
  onSelect: (days: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {SUBSCRIPTION_INTERVALS.map((days) => {
        const active = value === days;
        return (
          <button
            key={days}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => {
              if (!active) onSelect(days);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
              active
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-border text-muted-foreground hover:border-brand-300 hover:text-foreground"
            )}
          >
            {intervalLabel(days)}
          </button>
        );
      })}
    </div>
  );
}
