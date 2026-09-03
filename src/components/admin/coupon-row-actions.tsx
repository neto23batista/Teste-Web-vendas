"use client";

import Link from "next/link";
import { Pencil, Trash2, Power, PowerOff, Loader2 } from "lucide-react";
import { toggleCoupon, deleteCoupon } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function CouponRowActions({
  id,
  active,
  code,
}: {
  id: string;
  active: boolean;
  code: string;
}) {
  const { pending, run, confirm, dialog } = useConfirmAction();

  const toggle = () =>
    void run({
      action: () => toggleCoupon(id),
      successMessage: active ? "Cupom desativado." : "Cupom ativado.",
    });

  const remove = () =>
    confirm({
      title: "Excluir cupom",
      confirmLabel: "Excluir cupom",
      destructive: true,
      confirmMessage: `Excluir o cupom “${code}”? O desconto deixará de estar disponível para novas compras. Confira os vínculos e o histórico antes de confirmar.`,
      action: () => deleteCoupon(id),
      successMessage: "Cupom excluído.",
    });

  return (
    <div className="flex items-center justify-end gap-1">
      {dialog}
      <button
        onClick={toggle}
        disabled={pending}
        title={active ? "Desativar" : "Ativar"}
        aria-label={`${active ? "Desativar" : "Ativar"} cupom ${code}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : active ? (
          <Power className="size-4" />
        ) : (
          <PowerOff className="size-4" />
        )}
      </button>
      <Link
        href={`/admin/cupons/${id}`}
        title="Editar"
        aria-label={`Editar cupom ${code}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        onClick={remove}
        disabled={pending}
        title="Excluir"
        aria-label={`Excluir cupom ${code}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
