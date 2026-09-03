"use client";

import Link from "next/link";
import { Loader2, RefreshCw, Undo2, ShieldAlert } from "lucide-react";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import {
  recheckQuarantinedPayment,
  refundQuarantinedPayment,
} from "@/client/api/admin";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";

export type QuarantinedPaymentRow = {
  orderId: string;
  number: string;
  total: number;
  customerName: string;
  externalId: string | null;
  detail: string | null;
  since: string;
};

/**
 * Fila de conciliação de cobranças divergentes.
 *
 * Um item aqui significa dinheiro possivelmente retido no provedor sem pedido
 * confirmado. Nada sai daqui sozinho — por isso a fila fica no topo da tela do
 * financeiro, e não escondida atrás de um filtro.
 */
export function PaymentQuarantine({ rows }: { rows: QuarantinedPaymentRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-danger-500/40 bg-danger-500/5 p-5">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger-500" />
        <div>
          <h2 className="font-bold">
            Cobranças divergentes ({rows.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            O provedor informou valor ou moeda diferente do total do pedido. O
            valor pode estar retido lá: nada é confirmado, cancelado ou expirado
            automaticamente até alguém decidir aqui.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <QuarantineRow key={row.orderId} row={row} />
        ))}
      </ul>
    </section>
  );
}

function QuarantineRow({ row }: { row: QuarantinedPaymentRow }) {
  const { pending, confirm, run, dialog } = useConfirmAction();

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      {dialog}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/admin/pedidos/${row.orderId}`}
          className="font-bold underline underline-offset-2"
        >
          {row.number}
        </Link>
        <span className="text-sm text-muted-foreground">
          {row.customerName} · total {formatBRL(row.total)} · desde {row.since}
        </span>
      </div>

      <p className="mt-1.5 text-sm font-medium text-danger-500">Pagamento divergente em análise. O pedido aguarda uma decisão de conciliação.</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        Referência operacional: {row.number}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void run({
              action: () => recheckQuarantinedPayment(row.orderId),
              successMessage: "Cobrança conciliada e pedido confirmado.",
              warningMessage: "Conciliação ainda pendente. Confira a situação atualizada antes de decidir o estorno.",
            })
          }
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Reconsultar provedor
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => confirm({
            title: `Estornar cobrança de ${row.number}`,
            confirmLabel: "Estornar e cancelar pedido",
            destructive: true,
            confirmMessage: `O valor efetivamente cobrado será devolvido ao cliente e o pedido ${row.number}, cujo total esperado é ${formatBRL(row.total)}, será cancelado. A conclusão financeira depende da confirmação do provedor. O estorno não pode ser desfeito neste painel.`,
            action: () => refundQuarantinedPayment(row.orderId),
            successMessage: "Estorno confirmado e pedido cancelado.",
            warningMessage: "Pedido cancelado. O estorno está pendente de confirmação; acompanhe a liquidação no painel.",
          })}
        >
          <Undo2 className="size-4" />
          Estornar e cancelar
        </Button>
      </div>
    </li>
  );
}
