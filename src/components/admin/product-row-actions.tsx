"use client";

import Link from "next/link";
import { Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toggleProductActive, deleteProduct } from "@/client/api/admin";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function ProductRowActions({
  id,
  active,
  name,
}: {
  id: string;
  active: boolean;
  name: string;
}) {
  const { pending, confirm, dialog } = useConfirmAction();

  const toggle = () =>
    confirm({
      title: active ? "Desativar produto" : "Ativar produto",
      confirmLabel: active ? "Desativar produto" : "Ativar produto",
      confirmMessage: `${name} ${active ? "deixará de aparecer para novas compras" : "poderá aparecer para novas compras, conforme a disponibilidade"}. O histórico dos pedidos será preservado.`,
      action: () => toggleProductActive(id),
      successMessage: active ? "Produto desativado." : "Produto ativado.",
    });

  const remove = () =>
    confirm({
      title: "Excluir produto",
      confirmLabel: "Excluir produto",
      destructive: true,
      confirmMessage: `Excluir “${name}”? Esta operação não pode ser desfeita. O servidor verificará os vínculos existentes antes de permitir a exclusão. Para apenas suspender vendas, use Desativar.`,
      action: () => deleteProduct(id),
      successMessage: "Produto excluído.",
    });

  return (
    <div className="flex items-center justify-end gap-1">
      {dialog}
      <button
        onClick={toggle}
        disabled={pending}
        title={active ? "Desativar" : "Ativar"}
        aria-label={`${active ? "Desativar" : "Ativar"} produto ${name}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : active ? (
          <Eye className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )}
      </button>
      <Link
        href={`/admin/produtos/${id}`}
        title="Editar"
        aria-label={`Editar produto ${name}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        onClick={remove}
        disabled={pending}
        title="Excluir"
        aria-label={`Excluir produto ${name}`}
        className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
